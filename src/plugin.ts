import Server, { Plugin, Session, Socket } from 'reacting-squirrel/server';
import RSConnector, { ApiWrapper, Builder, DataResponse } from 'resting-squirrel-connector';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface IRSConnectorOptions {
	url: string;
	dataKey?: string;
	errorKey?: string;
	meta?: boolean;
	apiKey?: string;
	keepAlive?: boolean;
	logWarning?: boolean;
}

export interface IApi {
	name: string;
	connectorOptions: IRSConnectorOptions;
	sign?: <S extends Session>(socket: Socket<S>, builder: Builder, data: Partial<ISocketData>) => Promise<void>;
	transformResponse?: <T>(data: DataResponse & T) => any;
	handleResponse?: <S extends Session, T>(socket: Socket<S>, method: HttpMethod, endpoint: string, input: Partial<ISocketData>, response: DataResponse & T) => Promise<void>;
	modifyBuilder?: <S extends Session>(socket: Socket<S>, builder: Builder, data: Partial<ISocketData>) => void;
	getBroadcastFilter?: <S extends Session>(socket: Socket<S>) => Promise<(socket: Socket<S>) => boolean>;
	onError?: <S extends Session>(socket: Socket<S>, error: any) => void;
}

interface IDoc {
	description: string;
	args: any;
	params: any;
	required_params: string[];
	required_auth: boolean;
	auth: 'REQUIRED' | 'OPTIONAL' | 'DISABLED';
	response: any;
	response_type: string;
	errors: any;
	deprecated: boolean;
}

interface IDocsResponse {
	[endpoint: string]: IDoc;
}

interface ISocketData {
	args: any;
	params: any;
	broadcast: boolean;
	headers: any;
	authType: string;
	[key: string]: any;
}

export interface IOptions {
	apis: IApi[];
	logging?: boolean;
	retries?: number;
}

export default class RSNut extends Plugin {

	private _options: IOptions;

	private _apis: Record<string, ApiWrapper> = {};

	private _retries: Record<string, number> = {};

	private _retryTimeout: number = 5000;

	constructor(options: IOptions) {
		super();
		this._options = options;
	}

	public async register(server: Server): Promise<void> {
		const { apis = [] } = this._options;
		if (!apis.length) {
			server.logWarning('RSNut Plugin', 'No apis defined.');
		}
		for (const api of apis) {
			await this._registerApi(server, api);
		}
		await super.register(server);
	}

	public getName(): string {
		return 'RS Nut';
	}

	public getConnector(key: string): ApiWrapper {
		return this._apis[key];
	}

	private async _registerApi(server: Server, api: IApi): Promise<void> {
		const { retries } = this._options;
		let docs: IDocsResponse;
		if (!this._apis[api.name]) {
			this._apis[api.name] = RSConnector(api.connectorOptions);
		}
		if (this._retries[api.name] === undefined) {
			this._retries[api.name] = 0;
		}
		try {
			docs = await this._apis[api.name].get<IDocsResponse>('/docs');
		} catch (error) {
			if (retries && this._retries[api.name] < retries) {
				this._retries[api.name]++;
				server.logWarning(
					this.getName(),
					`API ${api.name} error`,
					error,
					`Retry attempt ${this._retries[api.name]} of ${retries}.`,
				);
				server.logWarning(this.getName(), `Retriyng.`);
				await this._wait(this._retryTimeout);
				await this._registerApi(server, api);
				return;
			}
			throw error;
		}
		// tslint:disable-next-line: forin
		for (const [endpoint, doc] of Object.entries(docs)) {
			this._registerSocketEvent(server, api, endpoint, doc);
		}
	}

	private _registerSocketEvent(server: Server, api: IApi, endpoint: string, doc: IDoc): void {
		const key = `${api.name}.${endpoint}`;
		server.registerSocketEvent(key, async (socket, data: Partial<ISocketData> = {}) => {
			const { args, params, broadcast, headers } = data;
			const [m, endpoint] = key.split(' ');
			const [, method] = m.split('.') as [void, HttpMethod];
			if (this._options.logging) {
				// tslint:disable-next-line: no-console
				console.log(new Date(), `[${this.getName()}]`, '[LOG]', `API: ${api.name} method: ${method} endpoint: ${endpoint} args: ${JSON.stringify(args || {})} params: json[${JSON.stringify(params || {}).length}]`);
			}
			const r = this._createApiRequest(api.name, method.toLowerCase() as any, endpoint)
				.params(params)
				.args(args)
				.headers(headers);
			switch (doc.auth) {
				case 'REQUIRED':
					if (!socket.getSession().getUser()) {
						throw new Error('User not logged.');
					}
					await api.sign(socket, r, data);
					break;
				case 'OPTIONAL':
					if (socket.getSession().getUser()) {
						await api.sign(socket, r, data);
					}
					break;
			}
			if (typeof api.modifyBuilder === 'function') {
				api.modifyBuilder(socket, r, data);
			}
			let response: DataResponse;
			try {
				response = await r.execute();
			} catch (e) {
				if (typeof api.onError === 'function') {
					api.onError(socket, e);
				}
				throw e;
			}
			if (typeof api.transformResponse === 'function') {
				response = api.transformResponse(response);
			}
			if (typeof api.handleResponse === 'function') {
				await api.handleResponse(socket, method, endpoint, data, response);
			}
			if (broadcast) {
				let filter: (socket: Socket<Session>) => boolean;
				if (typeof api.getBroadcastFilter === 'function') {
					filter = await api.getBroadcastFilter(socket);
				}
				socket.broadcast(key, { data: response }, false, filter);
			}
			return response;
		});
	}

	private _createApiRequest(name: string, method: 'get' | 'post' | 'put' | 'delete', endpoint: string): Builder {
		const Api = this._apis[name].v(null);
		const r = new Api.Request();
		return r[method](endpoint);
	}

	private _wait(timeout: number): Promise<void> {
		return new Promise((resolve) => {
			setTimeout(resolve, timeout);
		});
	}
}
