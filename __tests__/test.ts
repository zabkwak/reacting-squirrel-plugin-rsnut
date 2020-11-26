import { expect } from 'chai';
import * as path from 'path';
import Server from 'reacting-squirrel/server';
import rs from 'resting-squirrel';

import Plugin from '../dist/plugin';

const frontend = new Server({
	appDir: path.resolve(__dirname, './app'),
	dev: false,
	port: 8080,
	staticDir: path.resolve(__dirname, './public'),
});

const api = rs({
	port: 8081,
	log: false,
});

api.get(0, '/test', async () => {
	return { status: 'ok' };
});
frontend
	.registerRoute('get', '/', 'pages/home', 'Home')
	.registerPlugin(new Plugin({
		apis: [
			{
				name: 'local',
				connectorOptions: {
					url: 'http://localhost:8081',
				},
			},
		]
	}));

describe('Servers start', () => {

	it('starts the api server', (done) => {
		api.start(done);
	});

	it('starts the frontend server', (done) => {
		frontend.start(done);
	}).timeout(20000);
});

describe('Servers stop', () => {

	it('stops the frontend server', (done) => {
		frontend.stop(done);
	});

	it('stops the api server', (done) => {
		api.stop(done);
	});
});
