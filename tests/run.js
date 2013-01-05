"use strict";

var Runner = require ("mocha-runner");

new Runner ({
	tests: ["grab-bag.js"]
}).run (function (error){
	if (error) console.log (error);
});