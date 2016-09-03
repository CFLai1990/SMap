//Manager: 路由相当于处理程序的管理者，决定调用哪个程序来响应特定需求
var express = require("express");
var url = require("url");
var bodyParser = require('body-parser');
var router = express.Router();
var logger;

function useHandle(func, queryFunc){
	return function(request, response, next){
	    var pathname = url.parse(request.url).pathname;
		if(request.method!="GET"){
			next();
			return;
		}
		logger.log("  Router: About to route a request from "+ pathname);
		switch(pathname){
			case "/query":
				queryFunc(request, response);
			break;
			default:
				func(pathname, response, next);
			break;
		}
	};
}

function initialize(handle, v_logger){
	//Get handlers
	logger = v_logger;
	router.use(useHandle(handle['file'], handle["query"]));
	for(var t_path in handle){
		if(typeof handle[t_path]==='function'){
			if(t_path.indexOf('/')>=0){
				router.get(t_path, useHandle(handle[t_path], handle['query'], handle["stream"]));
			}
		}
	}
	//Post handlers
	// var jsonParser = bodyParser.json();
	// router.post('/json/*', jsonParser, function(request, response, next){
	//     var pathname = url.parse(request.url).pathname;
	// 	logger.log("  Router: About to route a request from "+ pathname);
	// 	handle['upload'](request, response);
	// });
	return router;
}

exports.initialize = initialize;