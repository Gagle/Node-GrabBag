"use strict";

var ep = require ("error-provider");
var fs = require ("fs");
var path = require ("path");
var properties = require ("properties");

ep.create (ep.next (), "RESOURCE_NOT_FOUND", "The resource does not exist",
		{ path: "{path}" });
ep.create (ep.next (), "INVALID_JSON", "{error}", { path: "{path}" });

if (!path.sep) path.sep = process.platform === "win32" ? "\\" : "/";
		
var gb = module.exports = {};

var custom = 0;

gb.create = function (name){
	return new GrabBag (name);
};

gb.define = function (extensions, io){
	var type = {
		reader: io.reader,
		writer: io.writer
	};
	gb.types["CUSTOM" + (custom++)] = type;
	extensions.forEach (function (ext){
		supportedExtensions[ext] = type;
	});
};

var removeType = function (type){
	for (var ext in supportedExtensions){
		if (supportedExtensions[ext] === type) return;
	}
	for (var t in gb.types){
		if (gb.types[t] === type){
			delete gb.types[t];
			return;
		}
	}
};

gb.remove = function (extensions){
	extensions.forEach (function (ext){
		var type = supportedExtensions[ext];
		if (!type) return;
		delete supportedExtensions[ext];
		removeType (type);
	});
};

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
	}
};

var supportedExtensions = {
	"properties": gb.types.PROPERTIES,
	"ini": gb.types.INI,
	"json": gb.types.JSON,
};

var GrabBag = function (name){
	this._name = name;
	this._resources = {};
	this._types = {};
	this._ignored = {};
};

GrabBag.prototype.get = function (p){
	if (!p) return this._resources;
	var holder = this._resources;
	var paths = p.split (/\\|\//);
	for (var i=0, len=paths.length; i<len; i++){
		holder = holder[paths[i]];
		if (holder === undefined){
			return null;
		}
	}
	return holder;
};

GrabBag.prototype.ignore = function (p){
	if (typeof p === "string"){
		p = [p];
	}
	var me = this;
	p.forEach (function (p){
		me._ignored[p.replace (/\/|\\/g, path.sep)] = null;
	});
};

var loadFile = function (file, type, cb){
	var extname = path.extname (file);
	if (extname[0] === ".") extname = extname.substring (1);
	if (!type){
		if (extname in supportedExtensions){
			type = supportedExtensions[extname];
		}else{
			return cb (null, null, null);
		}
	}
	if (!type.reader) return cb (null, null, null);
	type.reader (file, extname, function (error, data){
		if (error) return cb (error, null, null);
		cb (null, data, type);
	});
};

GrabBag.prototype._isIgnored = function (p){
	return p.replace (/\/|\\/g, path.sep) in this._ignored;
}

GrabBag.prototype.load = function (p, type, cb){
	if (arguments.length === 2){
		cb = type;
		type = null;
	}

	var load = function (p, type, resHolder, typeHolder, cb){
		var exit = function (error){
			if (error){
				errors.push (error);
			}
			cb ();
		};
		
		if (me._isIgnored (p)) return exit ();
		
		fs.stat (p, function (error, stats){
			if (error) return exit (error);
			
			if (stats.isFile ()){
				loadFile (p, type, function (error, data, type){
					if (error) return exit (error);
					if (type === null) return exit ();
					
					var extname = path.extname (p);
					if (extname[0] === ".") extname = extname.substring (1);
					var basename = path.basename (p);
					resHolder[basename] = data;
					typeHolder[basename] = { type: type, path: p, extension: extname,
							set: false };
					
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
						load (p + path.sep + entry, type, resHolder, typeHolder, finish);
					});
				});
			}else{
				exit ();
			}
		});
	};
	
	var errors = [];
	var types;
	
	if (typeof p === "string"){
		p = [p];
	}else if (!Array.isArray (p)){
		var arr = [];
		types = [];
		for (var f in p){
			arr.push (f);
			types.push (p[f]);
		}
		p = arr;
	}
	
	var remaining = p.length;
	if (!remaining) return cb (null);
	
	var finish = function (){
		if (!--remaining) cb (errors.length === 0 ? null : errors);
	};
	
	var me = this;
	
	var i = 0;
	p.forEach (function (p){
		load (p, types ? types[i] : type, me._resources, me._types, finish);
		i++;
	});
};

GrabBag.prototype.name = function (){
	return this._name;
};

GrabBag.prototype.remove = function (p){
	if (!p){
		this._resources = {};
		this._types = {};
		return;
	}
	if (typeof p === "string"){
		p = [p];
	}
	var me = this;
	p.forEach (function (p){
		var resHolder = me._resources;
		var resType = me._types;
		var paths = p.split (/\\|\//);
		for (var i=0, len=paths.length; i<len-1; i++){
			resHolder = resHolder[paths[i]];
			resType = resType[paths[i]];
			if (resHolder === undefined){
				return null;
			}
		}
		var name = paths[paths.length - 1];
		delete resHolder[name];
		delete resType[name];
	});
};

GrabBag.prototype._createHolders = function (p){
	var parent = function (p, res, typ){
		if (p === ".") return { res: res, typ: typ };
		var h = parent (path.dirname (p), res, typ);
		var name = path.basename (p);
		var hres = h.res[name];
		var htyp = h.typ[name];
		if (hres === undefined){
			hres = {};
			h.res[name] = hres;
			htyp = {};
			h.typ[name] = htyp;
		}
		return { res: hres, typ: htyp };
	};
	
	return parent (path.dirname (p), this._resources, this._types);
};

GrabBag.prototype.set = function (p, type, obj){
	if (arguments.length === 2){
		obj = type;
		type = null;
	}
	var extname = path.extname (p);
	if (extname[0] === ".") extname = extname.substring (1);
	if (!type){
		if (extname in supportedExtensions){
			type = supportedExtensions[extname];
		}else{
			return;
		}
	}
	var h = this._createHolders (p);
	var name = path.basename (p);
	h.res[name] = obj;
	h.typ[name] = { type: type, path: p, extension: extname, set: true };
};

var mkdirs = function (p, set, cb){
	if (p === "." || !set) return cb (null);
	
	fs.mkdir (p, function (error){
		if (error && error.code !== "ENOENT" && error.code !== "EEXIST"){
			return cb (error);
		}else if (error && error.code === "EEXIST"){
			return cb (null);
		}else if (!error){
			return cb (null);
		}
		
		//ENOENT
		mkdirs (path.dirname (p), set, function (error){
			if (error) return cb (error);
			fs.mkdir (p, cb);
		});
	});
};

GrabBag.prototype.store = function (p, cb){
	if (arguments.length === 1){
		cb = p;
		p = null;
	}
	
	var store = function (p, resHolder, typeHolder, cb){
		if (me._isIgnored (p)) return cb ();
	
		if (typeHolder.type){
			if (typeHolder.type.writer){
				mkdirs (path.dirname (typeHolder.path), typeHolder.set,
						function (error){
							if (error){
								errors.push (error);
								return cb ();
							}
							typeHolder.type.writer (typeHolder.path, typeHolder.extension,
								resHolder, function (error){
									if (error) errors.push (error);
									cb ();
								});
						});
			}
		}else{
			var remaining = Object.keys (resHolder).length;
			if (!remaining) return cb ();
			
			var finish = function (){
				if (!--remaining) cb ();
			};
		
			for (var r in resHolder){
				store (p === "." ? r : p + path.sep + r, resHolder[r], typeHolder[r],
						finish);
			}
		}
	};
	
	var errors = [];
	var me = this;
	
	if (!p){
		return store (".", this._resources, this._types, function (){
			cb (errors.length === 0 ? null : errors);
		});
	}
	
	if (typeof p === "string"){
		p = [p];
	}
	
	var remaining = p.length;
	if (!remaining) return cb (null);
	
	var finish = function (){
		if (!--remaining) cb (errors.length === 0 ? null : errors);
	};
	
	p.forEach (function (p){
		var resHolder = me._resources;
		var typeHolder = me._types;
		
		var paths = p.split (/\\|\//);
		for (var i=0, len=paths.length; i<len; i++){
			resHolder = resHolder[paths[i]];
			typeHolder = typeHolder[paths[i]];
			if (resHolder === undefined){
				return cb ([ep.get ("RESOURCE_NOT_FOUND", { path: p })]);
			}
		}
		
		store (p, resHolder, typeHolder, finish);
	});
};