# Javascript Building System

## Features

- Javascript ES6 and stage-0 features support
- Auto build on file changes

## Install Required Packages

```sh
$ npm install
```

## Build Library

```sh
$ gulp script:lib
```

Run this script only when new library is included. Modify `libs` in `gulpfile.js`
to configure external libraries. npm packages are recommended. If you manually download
the library file, set a mapping in `package.json` like:

```json
"browser" : {
	"jquery": "./client/js/lib/jquery.js"
}
```

## Build Application

```sh
$ npm start
```

The entry point is `client/js/main.js`. browserify will analyse file dependencies and
bundle required files into `server/static/js/app.lib`. Library files will be excluded.

The system will start a simple `flask` server. Goto http://127.0.0.1:8912/.
