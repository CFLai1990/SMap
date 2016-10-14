var root = __dirname, glbTest = true, port = 2050;
var database = require("./server/database/database.js");
var logger = require("./server/logger.js").initialize();
database.initialize(logger);
// var views = require("./server/views/views.js").initialize(database, logger);
var handle = require("./server/handler/handler").initialize(root, database, logger);
var router = require("./server/router/router").initialize(handle, logger);
var server = require("./server/server").initialize(router, port);