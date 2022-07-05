# reacting-squirrel-plugin-rsnut
The plugin to load [resting-squirrel](https://www.npmjs.com/package/resting-squirrel) docs and converts it to socket events.

## Usage
### rsconfig.json
```json
{
	...config,
	"plugins": [
		...plugins,
		[
			"reacting-squirrel-plugin-rsnut",
			{
				"apis": [
					{
						"name": "api",
						"connectorOptions": {
							"url": "https://some.api.url"
						}
					}
				]
			}
		]
	]
}
```

### typescript
```typescript
import path from 'path';
import Server from 'reacting-squirrel/server';
import rs from 'resting-squirrel';
import RSNut from 'reacting-squirrel-plugin-rsnut';

const server = new Server({
	port: 8080,
});

server.registerPlugin(new RSNut({
	apis: [
		{
			name: 'api',
			connectorOptions: {
				url: 'https://some.api.url',
			},
		},
	],
}));
```