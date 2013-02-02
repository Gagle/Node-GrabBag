grab-bag
========

_Node.js project_

#### Easily loads and stores system resources ####

Version: 0.1.1

The main goal of this module is to ease the loading and storing process of system resources without the need to worry about how they are loaded and stored and where they are saved into memory, configure the I/O calls once and just load and store. A resource is anything you save in files, typically configuration data. A grab bag, or simply a box, provides a centralized and well organized place that grants to you a better control over your files.

Because encapsulation and abstraction is an art this module is the glue between your application and your configuration files. Useful when you have to load, update and store a lot of files with the minimum dependencies (loosely coupled). If you only want to load a couple of files this module is not made for you, it was thought for big projects with a lot of externalized data to provide an abstraction layer between the data and the way it is accessed.

Put it simply, you need to work with localized strings and you need to load, update and store some configuration files. You need to save them somewhere for a later use. You could create a module called "i18n" holding and managing all your language files. That's fine. Furthermore, your application needs to externalize some configuration properties so you could create another module called "conf" trying to encapsulate the way you load and store your files, or simply you could just load and store the configuration properties when you need to do so if encapsulation is not one of your strengths.

Have you thought the format of the data? You have to decide a format because you need to load and store them into files. Typically you'll use a json, ini or yaml file. Perhaps you don't need a complex format and you simply store the information in different lines. These methods are highly coupled with a lot of dependencies. If you need to change how you load and store the properties there's a big risk to break your code accidentally.

This is the way a grab bag works:

<p align="center">
	<img src="http://image.gxzone.com/images/7/a/7ae3a2a19c6.png" alt="diagram"/>
</p>

Instead of calling the parser/stringifier or just read/write the files you talk directly with the grab bag. To fill it you can load the files from disk ([load()](#load)) or just save in-memory objects ([set()](#set)). Then, you can retrieve and use them in your application ([get()](#get)) and persist the changes if you modify them ([store()](#store)).

The best part of this is that you configure how the data is loaded and stored into disk only once, so if you need to change anything related with the format it's very easy and safe to do the changes without affecting the whole application, therefore reducing the refactoring potential damage.


#### Installation ####

```
npm install grab-bag
```

#### Example ####

You need to load a directory named `conf`, a place where you put all your system configuration files. Inside it you have two files named `a.json` and `b.properties`. By default, you can only have .json, .propertis and .ini files but you can extend and overwrite the list defining your own readers and writers. Then you only need to do (assuming `conf` is inside `.`):

```javascript
var gb = require ("grab-bag");

var box = gb.create ("system");

//Loads recursively all the files inside conf
box.load ("conf", function (error){
	if (error) return console.log (error);
	
	var conf = box.get ("conf");
	//a.json file
	var a = conf["a.json"];
	//b.properties file
	var b = conf["b.properties"];
	
	/*
	Another way to get resources is through paths
	var a = gb.get ("conf/a.json");
	var b = gb.get ("conf/b.properties");
	*/
	
	//Modifies a.json and b.properties
	doSomething (conf);
	
	//Stores all the loaded resources to their files (overwriting them)
	box.store (function (error){
		if (error) return console.log (error);
	});
});
```

#### Methods and Properties ####

- [gb.create(name)](#create)
- [gb.define(extensions, io)](#define)
- [gb.remove(extensions)](#remove-gb)
- [gb.types](#types)
- [GrabBag#get([path])](#get)
- [GrabBag#ignore(paths)](#ignore)
- [GrabBag#load(path[, type], callback)](#load)
- [GrabBag#name()](#name)
- [GrabBag#remove([paths])](#remove)
- [GrabBag#set(path, obj[, type])](#set)
- [GrabBag#store([paths], callback)](#store)

<a name="create"></a>
__gb.create([name])__  
Creates a new GrabBag with an optional name.

<a name="define"></a>
__gb.define(extensions, io)__  
Defines a new parser/stringifier for every given extension.

The "extensions" parameter is an array of strings with all the extensions that will be used with the given reader and writer functions.

The "io" parameter is an object with the properties "reader" and "writer". This properties are the callbacks that are executed when you load or store the files. They are optional.

The reader receives the path of the file that needs to be parsed, the extension of this file and a callback to execute when the file is loaded. This callback expects an error and the loaded data as parameters.

The writer receives the path of the file that needs to be stored, the extension of this file, the data to store and a callback to execute when the file is loaded. This callback expects an error as parameter.

Default extensions and their associated parser/stringifier are:

- "properties": gb.types.PROPERTIES
- "ini": gb.types.INI
- "json": gb.types.JSON

For example, we need to add support for YAML files. We're going to use the [yaml.js](#https://github.com/jeremyfa/yaml.js) module to parse and stringify properties. Furthermore, we want to parse/stringify files with no extension as INI files.

```javascript
var yaml = require ("yamljs");
var gb = require ("grab-bag");
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
gb.define (["yml", "yaml"], {
	reader: reader,
	writer: writer
});

//Uses the built-in ini parser/stringifier to read/write files with no extension
gb.define ([""], gb.types.INI);
```

If you don't need to store yaml objects, ignore the writer function:

```javascript
gb.define (["yml", "yaml"], {
	reader: reader
});
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

gb.define (["ini"], {
	reader: reader,
	writer: writer
});
```

<a name="remove-gb"></a>
__gb.remove(extensions)__  
Removes extensions from the set of extensions bound to a parser/stringifier. For example, we don't want to parse/stringify files with `ini` extension.

```javascript
gb.remove (["ini"]);
```

Now, if a file with a `ini` extension is found it will be ignored.

<a name="types"></a>
__gb.types__  
Contains the default parsers/stringifiers. Every parser/stringifier has a "reader" and "writer" function that are used to load and store properties from disk.

- gb.types.PROPERTIES.reader, gb.types.PROPERTIES.writer
- gb.types.INI.reader, gb.types.INI.writer
- gb.types.JSON.reader, gb.types.JSON.writer

The PROPERTIES type uses the [properties](#https://github.com/Gagle/Node-Properties) module with the variables feature enabled.  
The INI type uses the [properties](#https://github.com/Gagle/Node-Properties) module with the variables and sections features enabled.  
The JSON type uses the Node.js built-in json parser/stringifier.  

The custom parser/stringifier defined with [gb.define()](#define) will be stored here with the name `CUSTOMX`, where `X` is an incremental number that starts at 0.

Default extensions and their associated type are:

- "properties": gb.types.PROPERTIES
- "ini": gb.types.INI
- "json": gb.types.JSON

<a name="get"></a>
__GrabBag#get([path])__  
Returns a resource given a path. If no path is given the function returns all the resources.

Example:

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
	"e": 4
}
```

```javascript
var box = gb.create ();

box.load (["a", "e.json"], function (error){
	if (error) return console.log (error);
	
	console.log (box.get ("a/b/b.json").a); //Prints: 2
	console.log (box.get ().a.b["b.json"].a); //Prints: 2
	console.log (box.get ("e.json").e); //Prints: 4
	console.log (require ("util").inspect (box.get (), true, null));
	
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
			e: 4
		}
	}
	*/
});
```

The paths are relative to the current working directory but they must not begin with `.` or `..`.

```javascript
//This is valid
gb.create ().get ("a");
gb.create ().get ("b/c");
//This is not valid
gb.create ().get ("./a");
gb.create ().get ("../a");
```

<a name="ignore"></a>
__GrabBag#ignore(paths)__  
Ignores the given resources when loading or storing. The "paths" parameter is an array of paths. The paths are relative to the current working directory but they must not begin with `.` or `..`.

```javascript
//This is valid
gb.create ().ignore (["a", "b/c"]);
//This is not valid
gb.create ().ignore (["./a", "../b"]);
```

For example, we have the following directory and we want to load `f1.json` and `f2.ini`.

```
./
	a/
		f1.json
		f2.ini
		f3.properties
```

We can load indivual files:

```javascript
gb.create ().load (["a/f1.json", "a/f2.ini"], function (error){
	if (error) return console.log (error);
});
```

Or we can ignore `f3.properties` and load the entire directory:

```javascript
var box = gb.create ();
box.ignore ("a/f3.properties");
box.load ("a", function (error){
	if (error) return console.log (error);
});
```

<a name="load"></a>
__GrabBag#load(path[, type], callback)__  
Loads resources from disk. The "path" parameter can be a string with the path to a file or directory or an array of paths. If a path points to a directory, the directory is read recursively and all the sub-directories and supported files are loaded. The callback receives an error parameter and is executed on completion. See [get()](#get) example.

How can we load files with no extension without loading other specific files, for example readme files?

```
./
	conf/
		file1
		file2
		README1
	system/
		boot.properties
		README2
		README3
```

Put it simply, define a new type and load both directories:

```javascript
gb.define ([""], gb.types.PROPERTIES);

var box = gb.create ();
box.load (["conf", "system"], function (error){
	if (error) return console.log (error);
});
```

Here we have a problem because the three README files should not be parsed but because we have included the empty extension as a valid extension, they are parsed.

A good solution is to define the empty extension and load files individually.

```javascript
gb.define ([""], gb.types.PROPERTIES);

var box = gb.create ();
box.load (["conf/file1", "conf/file2", "system/boot.properties"], function (error){
	if (error) return console.log (error);
});
```

But this has a problem because if you need to load a lot of files you have to include them manually in the array and they could have a different format so you can't load them with the same parser.

A better solution consists of using the [ignore()](#ignore) function. Just ignore the files that you don't want to load or store:

```javascript
gb.define ([""], gb.types.PROPERTIES);

var box = gb.create ();
box.ignore (["conf/README1", "system/README2", "system/README3"]);
box.load (["conf", "system"], function (error){
	if (error) return console.log (error);
});
```

The optional "type" parameter is the type of the content of the file, or files if the path is a directory. This parameter is typically used when you want to load a file that has an extension that is not found in the set of default extensions but you don't want to define a new type because you have multiple files with the same extension but with different format, like the previous scenario.

For example, we want to load a file with a txt extension that has a custom format (line separated values).

```
//users.txt
Broderick Distilo
Ellsworth Deperte
Willian Garzone
Marcellus Hoysock
Iesha Calvelo
```

```javascript
var type = {
	reader: function (file, extension, cb){
		fs.readFile (file, "utf8", function (error, data){
			if (error) return cb (error, null);
			cb (null, data.split (/\r\n|\n/));
		});
	}
};

var box = gb.create ();
box.load ("users.txt", type, function (error){
	if (error) return console.log (error);
	console.log (box.get ());
	
	/*
	Prints:
	
	{
		"users.txt": ["Broderick Distilo", "Ellsworth Deperte", "Willian Garzone", "Marcellus Hoysock", "Iesha Calvelo"]
	}
	*/
});
```

You can also use a predefined type:

```javascript
//file will be parsed as a .properties file
var box = gb.create ();
box.load ("file", gb.types.PROPERTIES, function (error){
	if (error) return console.log (error);
});
```

Load multiple files at once each of them with a different parser/stringifier is also possible:

```javascript
//file will be parsed as a .properties file
var box = gb.create ();

var type1 = {
	reader: function (file, extension, cb){
		//...
	}
};

var files = {
	"a/file1": gb.types.PROPERTIES, //file1 loaded/stored as a .properties file
	"a/file2": type1, //file2 loaded with the custom reader
	"file3.json": null, //file3 is loaded/stored as a .json file because it has a .json extension
	"file4": null, //file4 is ignored because it has no extension and the empty extension has not been defined as a type
	"b/dir1": null //The dir1 directory is read
};

box.load (files, function (error){
	if (error) return console.log (error);
});
```

<a name="name"></a>
__GrabBag#name()__  
Returns the name of the grab bag.

<a name="remove"></a>
__GrabBag#remove([paths])__  
Removes a resource, or resources if the path points to a directory. The "paths" parameter can be a string or an array of paths. Take into account that the resource (JavaScript object) won't be freed if you have a reference pointing to it. In fact, this function calls to `delete` to remove the resource. Be aware of this if you don't want memory leaks.


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
//e.json
{
	"e": 4
}
```

```javascript
var box = gb.create ();

box.load (["a", "e.json"], function (error){
	if (error) return console.log (error);
	
	box.remove ("a");
	
	console.log (require ("util").inspect (box.get (), true, null));
	
	/*
	Prints:
	
	{
		"e.json": {
			e: 4
		}
	}
	*/
});
```

The paths are relative to the current working directory but they must not begin with `.` or `..`.

```javascript
//This is valid
gb.create ().remove (["a", "b/c"]);
//This is not valid
gb.create ().remove (["./a", "../a"]);
```

<a name="set"></a>
__GrabBag#set(path[, type], obj)__  
Saves an object into the grab bag. Instead of loading a file from disk to fill the grab bag you can populate it with in-memory objects. Make sure to not to maintain a reference to the object you want to put in the grab bag because if you want to free the object you'll produce a memory leak. Reminder: an object is garbage collected if it is not referenced by any variable.

The path is relative to the current working directory but it must not begin with `.` or `..`.

```javascript
//This is valid
gb.create ().set ("a.ini", { p: 1 });
//This is not valid
gb.create ().set ("./a.ini", { p: 1 });
gb.create ().set ("../a.ini", { p: 1 });
```

<a name="store"></a>
__GrabBag#store([paths], callback)__  
Stores the resources into their files. The "paths" parameters can be a string with the path to a file or directory or an array of paths. If an array is passed all the resources are stored in parallel. If the path points to a directory, all the resources that has been previously loaded into memory that belongs to this path will be stored recursively. The callback with an error parameter is executed on completion, if any. If "paths" is not passed, stores all the loaded resources.

Example:


```
./
	a/
		a.json
		b/
			b.json
			c/
				c.properties
```

```javascript
var box = gb.create ();

box.load ("a", function (error){
	if (error) return console.log (error);
	
	box.store ("b", function (error){
		if (error) return console.log (error);
		
		//"b" points to a directory so b.json and c.properties have been updated
	});
});
```


The paths are relative to the current working directory but they must not begin with `.` or `..`.

```javascript
//This is valid
gb.create ().store ("a.ini", function (error){});
//This is not valid
gb.create ().set ("./a.ini", function (error){});
gb.create ().set ("../a.ini", function (error){});
