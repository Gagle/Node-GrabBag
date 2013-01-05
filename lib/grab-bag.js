"use strict";

var ep = require ("error-provider");
var fs = require ("fs");
var path = require ("path");
var properties = require ("properties");

ep.create (ep.next (), "NOT_A_RESOURCE", "The resource is not a file or " +
		"directory", { path: "{path}" });
ep.create (ep.next (), "FILE_TYPE_NOT_SUPPORTED", "The format of the given " +
		"file is not supported", { path: "{path}", extension: "{extension}" });
ep.create (ep.next (), "INVALID_JSON", "{error}", { path: "{path}" });
		
var gb = module.exports = {};

var resources = {};
var types = {};
var custom = 0;

gb.types = {
	PROPERTIES: {
		extnames: ["properties", "ini", "conf"],
		reader: function (file, extension, cb){
			properties.load (file, {
				sections: extension === "ini" ? true : false,
				variables: true,
				comments: extension === "ini" ? [";"] : null
			}, cb);
		},
		writer: function (file, extension, data, cb){
			properties.store (file, data, {
				sections: extension === "ini" ? true : false,
				comment: extension === "ini" ? ";" : null,
				pretty: true
			}, cb);
		}
	},
	JSON: {
		extnames: ["json"],
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
		extnames: ["js"],
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

gb.define = function (extnames, reader, writer){
	gb.types["CUSTOM" + (custom++)] = {
		extnames : extnames,
		reader: reader,
		writer: writer
	}
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

var getType = function (extname){
	var p;
	var i;
	var len;
	var type;
	for (p in gb.types){
		type = gb.types[p];
		for (i=0, len=type.extnames.length; i<len; i++){
			if (type.extnames[i] === extname){
				return type;
			}
		}
	}
	return null;
};

var loadFile = function (file, cb){
	var extname = path.extname (file);
	if (extname[0] === ".") extname = extname.substring (1);
	var type  = getType (extname);
	if (type){
		type.reader (file, extname, function (error, data){
			if (error) return cb (error, null, null, null);
			cb (null, data, type);
		});
	}else{
		cb (ep.get ("FILE_TYPE_NOT_SUPPORTED", { path: file, extension: extname }),
				null, null);
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
			typeHolder.type.writer (typeHolder.path, typeHolder.extension, resHolder,
					function (error){
				if (error) errors.push (error);
				cb ();
			});
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
		cb();
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