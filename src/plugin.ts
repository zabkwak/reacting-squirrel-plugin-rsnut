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

interface IApi {
	name: string;
	connectorOptions: IRSConnectorOptions;
	sign?: <S extends Session>(socket: Socket<S>, builder: Builder, data: Partial<ISocketData>) => Promise<void>;
	transformResponse?: <T>(data: DataResponse & T) => any;
	handleResponse?: <S extends Session, T>(socket: Socket<S>, method: HttpMethod, endpoint: string, input: Partial<ISocketData>, response: DataResponse & T) => Promise<void>;
	modifyBuilder?: <S extends Session>(socket: Socket<S>, builder: Builder, data: Partial<ISocketData>) => void;
	getBroadcastFilter?: <S extends Session>(socket: Socket<S>) => Promise<(socket: Socket<S>) => boolean>;
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
}

export interface IOptions {
	apis: IApi[];
}

export default class RSNut extends Plugin {

	private _options: IOptions;

	private _apis: { [key: string]: ApiWrapper } = {};

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
			this._apis[api.name] = RSConnector(api.connectorOptions);
			const docs = await this._apis[api.name].get<IDocsResponse>('/docs');
			// tslint:disable-next-line: forin
			for (const endpoint in docs) {
				this._registerSocketEvent(server, api, endpoint, docs[endpoint]);
			}
		}
		await super.register(server);
	}

	public getName(): string {
		return 'RS Nut';
	}

	private _registerSocketEvent(server: Server, api: IApi, endpoint: string, doc: IDoc): void {
		const key = `${api.name}.${endpoint}`;
		server.registerSocketEvent(key, async (socket, data: Partial<ISocketData> = {}) => {
			const { args, params, broadcast, headers } = data;
			const [m, endpoint] = key.split(' ');
			const [, method] = m.split('.') as [void, HttpMethod];
			const r = this._createApiRequest(api.name, method.toLowerCase() as any, endpoint)
				.setParams(params)
				.setArguments(args)
				.setHeaders(headers);
			switch (doc.auth) {
				case 'REQUIRED':
					if (!socket.getSession().getUser()) {
						throw new Error('User not logged.');
					}
					await api.sign(socket, r, data);
					break;
				case 'OPTIONAL':
					if (socket.getSession().getUser()) {
						api.sign(socket, r, data);
					}
					break;
			}
			if (typeof api.modifyBuilder === 'function') {
				api.modifyBuilder(socket, r, data);
			}
			let response = await r.execute();
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
		const Api = this._apis[name];
		const r = new Api.Request();
		return r[method](endpoint);
	}
}
