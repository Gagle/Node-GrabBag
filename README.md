grab-bag
========

_Node.js project_

#### Easily loads and stores system resources ####

Version: 0.0.3

This module can be used to ease the loading and storing process for system resources without the need to worry about how they are loaded and stored and how you save them in namespaces. A resource is anything you save in configuration files.

#### Installation ####

```
npm install grab-bag
```

#### Example ####

You need to load a directory named `conf`, a place where you put all your system configuration files. Inside it you have two files named `a.json` and `b.properties`. By default, you can only have json, key-value properties (.properties and INI files) and JavaScript modules but you can extend and overwrite the list defining your own readers and writers. Then you only need to do (assuming `conf` is inside `.`):

```javascript
var gb = require ("grab-bag");

//Loads recursively all the files inside conf
gb.load ("conf", function (error){
	if (error) return handleError (error);
	
	var conf = gb.get ("conf");
	//a.json file
	var a = conf["a.json"];
	//b.properties file
	var b = conf["b.properties"];
	
	/*
	Another way to get resources is through paths
	var a = gb.get ("conf/a.json");
	var b = gb.get ("conf/b.properties");
	*/
	
	//Modifies in-memory a.json and b.properties
	doSomething (conf);
	
	//Stores all the loaded resources to their files
	gb.store (function (error){
		if (error) return handleError (error);
	});
});
```

#### Methods and Properties ####

- [gb.define(extensions[, reader][, writer])](#define)
- [gb.extensions](#ext)
- [gb.get([resource])](#get)
- [gb.load(resource, callback)](#load)
- [gb.store([resource], callback)](#store)
- [gb.types](#types)

<a name="define"></a>
__gb.define(extensions[, reader][, writer])__  
Defines a new parser/stringifier for every extension.

The "extensions" parameter is an array of strings with all the extensions that will be used with the given reader and writer functions.

The "reader" and "writer" parameters are callbacks that are executed when you load or store the files.

The reader receives the path of the file that needs to be parsed, the extension of this file and a callback to execute when the file is loaded. This callback expects an error and the loaded data as parameters.

The writer receives the path of the file that needs to be stored, the extension of this file, the data to store and a callback to execute when the file is loaded. This callback expects an error as parameter.

For example, we need to add support for YAML files. We're going to use the [yaml.js](#https://github.com/jeremyfa/yaml.js) module to parse and stringify properties. Also, we want to parse/stringify files with no extension as INI files.

```javascript
var yaml = require ("yamljs");
var gb = requir ("grab-bag");
var fs = require ("fs");

var reader = function (file, extension, cb){
	fs.readFile (file, "utf8", function (error, data){
		if (error) return cb (error, null);
		try{
			cb (null, yaml.parse (data));
		}catch (e){
			cb (e, null);
		}
	});
};

var writer = function (file, extension, data, cb){
	fs.writeFile (file, yaml.stringify (data, 2), "utf8", cb);
};

//Defines a new parser/stringifier
gb.define (["yml", "yaml"], reader, writer);

//Uses the buil-in .ini parser/stringifier to read/write files with no extension
gb.define ([""], gb.types.INI.reader, gb.types.INI.writer);
```

If you don't need to store yaml objects, ignore the writer function:

```javascript
gb.define (["yml", "yaml"], reader);
```

You can also re-define existing extensions, for example, we want to replace the INI parser/stringifier with the [ini](#https://github.com/isaacs/ini) module:

```javascript
var ini = require ("ini");
var gb = requir ("grab-bag");
var fs = require ("fs");

var reader = function (file, extension, cb){
	fs.readFile (file, "utf8", function (error, data){
		if (error) return cb (error, null);
		cb (null, ini.parse (data));
	});
};

var writer = function (file, extension, data, cb){
	fs.writeFile (file, ini.stringify (data), "utf8", cb);
};

gb.define (["ini"], reader, writer);
```

Additionally, you can remove extensions from the set of extensions bound to a parser/stringifier. For example, we don't want to parse/stringify files with extension `js`. Both reader and writer functions must be ignored to remove the extension.

```javascript
gb.define (["conf"]);
```

Now, if a file with `conf` extension is found it won't be parsed.

The reader must be given if a writer is passed, that is, before writing to a file, the data has to be loaded with the reader function.

To know what extensions are bound to default parsers/stringifiers, see [gb.ext](#ext) and [gb.types](#types).

<a name="ext"></a>
__gb.extensions__  
Contains all the supported extensions and their associated parser/stringifier. By default the .properties parser/stringifier accepts "properties", "ini" and "conf" extensions, the json parser/stringifier, "json", and the JavaScript modules, "js".

- gb.extensions.properties === gb.types.PROPERTIES;
- gb.extensions.ini === gb.types.INI;
- gb.extensions.json === gb.types.JSON;
- gb.extensions.js === gb.types.JS;

<a name="get"></a>
__gb.get([resource])__  
Returns the given resource. The "resource" parameter is a path. If no path is passed the function returns all the loaded data:

```
./
	a/
		a.json
		b/
			b.json
		c/
			c.properties
			d/
	e.json
```

```
//a.json
{
	"a": 1
}
```

```
//b.json
{
	"b": 2
}
```

```
//c.json
{
	"c": 3
}
```

```
//e.json
{
	"d": 4
}
```

```javascript
gb.load (["a", "e.json"], function (error){
	if (error) return handleError (error);
	
	console.log (gb.get ("a/b/b.json").a); //Prints: 2
	console.log (gb.get ().a.b["b.json"].a); //Prints: 2
	console.log (gb.get ("e.json").d); //Prints: 4
	console.log (require ("util").inspect (gb.get (), true, null));
	
	/*
	Prints:
	
	{
		a: {
			"a.json": {
				a: 1
			},
			b: {
				"b.json": {
					b: 2
				}
			},
			c: {
				"c.json": {
					c: 3
				},
				d: {}
			}
		},
		"e.json": {
			d: 4
		}
	}
	*/
});
```

<a name="load"></a>
__gb.load(resource, callback)__  
Loads resources into memory. The "resource" parameters can be a string with the path to a file or directory or an array of strings. If an array is passed all the resources are loaded in parallel. If the path points to a directory, the directory is read recursively and all the files found are loaded. The callback with an error parameter is executed on completion.

<a name="store"></a>
__gb.store([resource], callback)__  
Stores resources into their files. The "resource" parameters can be a string with the path to a file or directory or an array of strings. If an array is passed all the resources are stored in parallel. If the path points to a directory, all the resources that has been loaded into memory previously that belongs to this path will be stored recursively, that is, if an in-memory directory is found, all the properties are stored to their files. The callback with an error parameter is executed on completion, if any. If "resource" is not passed, stores all the loaded resources.

<a name="types"></a>
__gb.types__  
Contains the default parsers/stringifiers. Every parser/stringifier has a "reader" and "writer" functions used to parse and store properties.

- gb.types.PROPERTIES.reader, gb.types.PROPERTIES.writer
- gb.types.INI.reader, gb.types.INI.writer
- gb.types.JSON.reader, gb.types.JSON.writer
- gb.types.JS.reader, gb.types.JS.writer

The PROPERTIES type uses the [properties](#https://github.com/Gagle/Node-Properties) module with the variables feature enabled.
The INI type uses the [properties](#https://github.com/Gagle/Node-Properties) module with the variables and sections features enabled.
The JSON type uses the built-in json parser/stringifier.
The JS type uses the `require` function to load the file, the script file need to export an object. Take into account that `require` is synchronous and therefore it will block the entire event loop.

The custom parser/stringifier defined with [gb.define()](#define) will be stored here with the name `CUSTOMX`, where `X` is an incremental number that starts at 0.

The extensions that are associated with each parser/stringifier can be found at [gb.ext](#ext).