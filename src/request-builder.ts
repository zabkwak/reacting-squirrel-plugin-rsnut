import { SocketComponent, SocketRequest } from 'reacting-squirrel';

export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export default class RequestBuilder<A = {}, P = {}, H = {}> {

	private _apiName: string;

	private _method: Method;

	private _version: number;

	private _endpoint: string;

	private _args: A;

	private _params: P;

	private _headers: H;

	private _data: { [key: string]: any };

	private _socketRequest: SocketRequest;

	private _timeout: number;

	private _broadcast: boolean;

	private _authType: string;

	private _onProgress: (progress: number) => void;

	constructor(apiName: string, socketRequest?: SocketRequest | SocketComponent<any, any, any>) {
		if (socketRequest instanceof SocketComponent) {
			// @ts-ignore
			socketRequest = socketRequest._socketRequest;
		}
		this._apiName = apiName;
		this._socketRequest = socketRequest;
	}

	/**
	 * Sets the method to `POST` and sets the endpoint.
	 *
	 * @param endpoint
	 */
	public post(endpoint: string): this {
		return this
			.method('POST')
			.endpoint(endpoint);
	}

	/**
	 * Sets the method to `GET` and sets the endpoint.
	 *
	 * @param endpoint
	 */
	public get(endpoint: string): this {
		return this
			.method('GET')
			.endpoint(endpoint);
	}

	/**
	 * Sets the method to `PUT` and sets the endpoint.
	 *
	 * @param endpoint
	 */
	public put(endpoint: string): this {
		return this
			.method('PUT')
			.endpoint(endpoint);
	}

	/**
	 * Sets the method to `DELETE` and sets the endpoint.
	 *
	 * @param endpoint
	 */
	public delete(endpoint: string): this {
		return this
			.method('DELETE')
			.endpoint(endpoint);
	}

	/**
	 * Sets the http method of the API request.
	 *
	 * @param method
	 */
	public method(method: Method): this {
		this._method = method;
		return this;
	}

	/**
	 * Sets the version of the endpoint.
	 *
	 * @param version
	 */
	public v(version: number): this {
		this._version = version;
		return this;
	}

	/**
	 * Sets the endpoint.
	 *
	 * @param endpoint
	 */
	public endpoint(endpoint: string): this {
		if (endpoint.indexOf('/') !== 0) {
			endpoint = `/${endpoint}`;
		}
		this._endpoint = endpoint;
		return this;
	}

	/**
	 * Sets the arguments of the API request.
	 *
	 * @param args
	 */
	public args(args: A): this {
		this._args = args;
		return this;
	}

	/**
	 * Sets the params of the API request.
	 *
	 * @param params
	 */
	public params(params: P): this {
		this._params = params;
		return this;
	}

	/**
	 * Sets the headers of the API request.
	 *
	 * @param headers
	 */
	public headers(headers: H): this {
		this._headers = headers;
		return this;
	}

	/**
	 * Sets the additional data to the socket request. This data aren't sent to the API automatically.
	 *
	 * @param data
	 * @returns
	 */
	public data(data: { [key: string]: any }): this {
		this._data = data;
		return this;
	}

	/**
	 * Sets the authorization type of the request.
	 *
	 * @param type
	 */
	public authType(type: string): this {
		this._authType = type;
		return this;
	}

	/**
	 * Sets the timeout of the socket request.
	 *
	 * @param timeout
	 */
	public timeout(timeout: number): this {
		this._timeout = timeout;
		return this;
	}

	/**
	 * Registers the `onProgress` callback in the socket request.
	 *
	 * @param onProgress
	 */
	public onProgress(onProgress: (progress: number) => void): this {
		this._onProgress = onProgress;
		return this;
	}

	/**
	 * The response of the API request is broadcasted to all other socket clients.
	 */
	public broadcast(): this {
		this._broadcast = true;
		return this;
	}

	/**
	 * Builds the params for the `SocketRequest.execute` method.
	 */
	// tslint:disable-next-line: max-line-length
	public build(): [string, { args?: A, params?: P, headers?: H, broadcast?: boolean, authType?: string, [key: string]: any }, number, (progress: number) => void] {
		return [
			`${this._apiName}.${this._method} ${this._version !== undefined ? `/${this._version}` : ''}${this._endpoint}`,
			{
				args: this._args,
				broadcast: this._broadcast,
				params: this._params,
				authType: this._authType,
				headers: this._headers,
				...this._data,
			},
			this._timeout,
			this._onProgress,
		];
	}

	/**
	 * Executes the socket request.
	 */
	public execute<T = any>(): Promise<T> {
		return this._socketRequest.execute<any, T>(...this.build());
	}
}
