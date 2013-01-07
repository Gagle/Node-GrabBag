"use strict";

var ep = require ("error-provider");
var fs = require ("fs");
var path = require ("path");
var properties = require ("properties");

ep.create (ep.next (), "NOT_A_RESOURCE", "The resource is not a file or " +
		"directory", { path: "{path}" });
ep.create (ep.next (), "INVALID_JSON", "{error}", { path: "{path}" });
		
var gb = module.exports = {};

var resources = {};
var types = {};
var custom = 0;

gb.types = {
	PROPERTIES: {
		reader: function (file, extension, cb){
			properties.load (file, {
				variables: true
			}, cb);
		},
		writer: function (file, extension, data, cb){
			properties.store (file, data, {
				pretty: true
			}, cb);
		}
	},
	INI: {
		reader: function (file, extension, cb){
			properties.load (file, {
				sections: true,
				variables: true,
				comments: [";"]
			}, cb);
		},
		writer: function (file, extension, data, cb){
			properties.store (file, data, {
				sections: true,
				comment: ";",
				pretty: true
			}, cb);
		}
	},
	JSON: {
		reader: function (file, extension, cb){
			fs.readFile (file, "utf8", function (error, data){
				if (error) return cb (error, null);
				try{
					cb (null, JSON.parse (data));
				}catch (e){
					var stack = e.stack;
					e = ep.get ("INVALID_JSON", { path: file, error: e });
					e.stack = stack;
					cb (e, null);
				}
			});
		},
		writer: function (file, extension, data, cb){
			fs.writeFile (file, JSON.stringify (data, null, 2), "utf8", cb);
		}
	},
	JS: {
		reader: function (file, extension, cb){
			try{
				cb (null, require (path.resolve (file)));
			}catch (e){
				cb (e, null);
			}
		},
		writer: function (file, extension, data, cb){
			fs.writeFile (file, "module.exports = " +
					JSON.stringify (data, null, 2) + ";", "utf8", cb);
		}
	}
};

gb.extensions = {
	"properties": gb.types.PROPERTIES,
	"ini": gb.types.INI,
	"json": gb.types.JSON,
	"js": gb.types.JS
};

var removeType = function (type){
	if (type === gb.types.PROPERTIES || type === gb.types.JSON ||
			type === gb.types.JS) return;
	for (var ext in gb.extensions){
		if (gb.extensions[ext] === type) return;
	}
	for (var t in gb.types){
		if (gb.types[t] === type){
			delete gb.types[t];
			return;
		}
	}
};

gb.define = function (extensions, reader, writer){
	if (arguments.length === 1){
		extensions.forEach (function (ext){
			var type = gb.extensions[ext];
			delete gb.extensions[ext];
			removeType (type);
		});
		return;
	}
	
	var type = {
		reader: reader,
		writer: writer
	};
	gb.types["CUSTOM" + (custom++)] = type;
	extensions.forEach (function (ext){
		gb.extensions[ext] = type;
	});
};

gb.get = function (p){
	if (!p) return resources;
	var holder = resources;
	var paths = p.split (/\\|\//);
	for (var i=0, len=paths.length; i<len; i++){
		holder = holder[paths[i]];
		if (holder === undefined){
			return null;
		}
	}
	return holder;
};

var loadFile = function (file, cb){
	var extname = path.extname (file);
	if (extname[0] === ".") extname = extname.substring (1);
	if (extname in gb.extensions){
		var type =  gb.extensions[extname];
		type.reader (file, extname, function (error, data){
			if (error) return cb (error, null, null);
			cb (null, data, type);
		});
	}else{
		cb (null, null, null);
	}
};

gb.load = function (p, cb){
	var load = function (p, resHolder, typeHolder, cb){
		var exit = function (error){
			if (error){
				errors.push (error);
			}
			cb ();
		};
		
		fs.stat (p, function (error, stats){
			if (error) return exit (error);
			
			if (stats.isFile ()){
				loadFile (p, function (error, data, type){
					if (error) return exit (error);
					if (type === null) return exit ();
					
					var extname = path.extname (p);
					if (extname[0] === ".") extname = extname.substring (1);
					var basename = path.basename (p);
					resHolder[basename] = data;
					typeHolder[basename] = { type: type, path: p, extension: extname };
					
					exit ();
				});
			}else if (stats.isDirectory ()){
				var basename = path.basename (p);
				resHolder[basename] = {};
				resHolder = resHolder[basename];
				typeHolder[basename] = {};
				typeHolder = typeHolder[basename];
				
				fs.readdir (p, function (error, entries){
					if (error) return exit (error);
					
					var remaining = entries.length;
					if (!remaining) return exit ();
					
					var finish = function (){
						if (!--remaining) exit ();
					};
					
					entries.forEach (function (entry){
						load (p + path.sep + entry, resHolder, typeHolder, finish);
					});
				});
			}else{
				exit (ep.get ("NOT_A_RESOURCE", { path: p }));
			}
		});
	};
	
	var errors = [];
	
	if (!Array.isArray (p)){
		p = [p];
	}
	
	var remaining = p.length;
	if (!remaining) return cb (null);
	
	var finish = function (){
		if (!--remaining) cb (errors.length === 0 ? null : errors);
	};
	
	p.forEach (function (res){
		load (res, resources, types, finish);
	});
};

gb.store = function (p, cb){
	if (arguments.length === 1){
		cb = p;
		p = null;
	}
	
	var store = function (resHolder, typeHolder, cb){
		if (typeHolder.type){
			if (typeHolder.type.writer){
				typeHolder.type.writer (typeHolder.path, typeHolder.extension,
						resHolder, function (error){
					if (error) errors.push (error);
					cb ();
				});
			}
		}else{
			var remaining = Object.keys (resHolder).length;
			if (!remaining) return cb ();
			
			var finish = function (){
				if (!--remaining) cb ();
			};
		
			for (var r in resHolder){
				store (resHolder[r], typeHolder[r], finish);
			}
		}
		cb ();
	};
	
	var errors = [];
	
	if (!p){
		return store (resources, types, function (){
			cb (errors.length === 0 ? null : errors);
		});
	}
	
	if (!Array.isArray (p)){
		p = [p];
	}
	
	var remaining = p.length;
	if (!remaining) return cb (null);
	
	var finish = function (){
		if (!--remaining) cb (errors.length === 0 ? null : errors);
	};
	
	p.forEach (function (res){
		var resHolder = resources;
		var typeHolder = types;
		
		var paths = res.split (/\\|\//);
		for (var i=0, len=paths.length; i<len; i++){
			resHolder = resHolder[paths[i]];
			typeHolder = typeHolder[paths[i]];
			if (resHolder === undefined){
				return cb ([ep.get ("NOT_A_RESOURCE", { path: res })]);
			}
		}
		
		store (resHolder, typeHolder, finish);
	});
};