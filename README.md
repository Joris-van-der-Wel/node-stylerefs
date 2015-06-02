stylerefs [FILES] OPTIONS
=========================

  _Walk the dependency graph of your node modules to look for
  CSS/LESS/SCSS/Stylus file reference annotations. These files can then be
  bundled into a single CSS file._

USAGE:
------

Each node.js module passed to this command is (recursively) analyzed for lines
containing `require()`, this results in a list of all javascript modules that might
be used in your project. All of those javascript modules can define a reference to
a stylesheet using a simple annotation:

    require('static-reference')('./myfile.less', 'filter', 'keyword');

This line has no effect if you run your javascript ('static-reference' is a dummy
package that does nothing).

This command outputs a bundle of CSS, or LESS, or SASS, etc.

TUTORIAL:
---------
_This example can be found in the `example/` directory of this package._

`first-example.js`:

```javascript
var bar = require('./foo/bar.js');
require('static-reference')('./first-example.css');
console.log('hello', bar);
```

`foo/bar.js`:

```javascript
require('static-reference')('./bar.css');
module.exports = 'world!';
```

If you run `node first-example.js`, you will see a simple `hello world!` message.

If you now execute this command:

    stylerefs first-example.js --concat

You wil get the following output:

```CSS
/* foo/bar.css */
.bar {
    color: blue;
}

/* first-example.css */
.first-example {
    color: red;
}
```

---

It is also possible to output `@import` statements:

    stylerefs first-example.js --import

Will give you:

    @import "foo/bar.css";
    @import "first-example.css";

---

Import statements work well in combination with a preprecessor such as [less](https://www.npmjs.com/package/less).


`second-example.js`:

```javascript
var baz = require('./foo/baz.js');
require('static-reference')('./second-example.less');
console.log('hello', baz);
```

`second-example.less`:

```LESS
/* second-example.less */
.second-example {
        color: green;
        &:hover {
                color: red;
        }
}
```

If you now run:

    stylerefs second-example.js --filter 'less' --import | lessc -

You will get:

```CSS
/* foo/baz.less */
.baz {
  width: 20px;
}
/* second-example.less */
.second-example {
  color: green;
}
.second-example:hover {
  color: red;
}
```

Because stylerefs is generating `@import` statements, less will show you any error with the correct line number. It also means that source maps will work properly:

    stylerefs second-example.js --filter 'less' --import > bundle.less
    lessc --line-numbers=comments --source-map-map-inline bundle.less > bundle.css

Source mapping is supported by various browser developer tools and shows you the original line number when debugging your CSS selectors.

The import option should work with less, scss and stylus.

OPTIONS are:
------------
    -h,  --help
    
    -v,  --verbose              Log debugging messages to STDERR, such as files 
                                that are being skipped for some reason.
    
    -f,  --filter=EXPRESSION    Only include references that match the given
                                boolean EXPRESSION, this expression is evaluated
                                upon the given arguments in the reference 
                                annotation, and the file extension of the file it
                                refers to:
                                --filter "css && abc && (def || ghj)" will match
                                  require('static-reference')('./bla.css', 'abc', 
                                          'def');
                                and
                                  require('static-reference')('./bla.css', 'abc',
                                          'ghj');
                                If --filter is given multiple times, all
                                EXPRESSIONs must match.
                                If no --filter is given, a default is implied:
                                --filter "css"
    
    -i,  --import               Output a single file containing only @import
                                statements to all referenced stylesheet files.
                                These @import statements are compatible with LESS,
                                SCSS and Stylus. And will result in a single large
                                CSS bundle when you compile the output of this
                                command. This option is implied if neither
                                --concat nor --json is given.
    
         --relative=RELPATH     Change the path that all generated file paths are
                                relative to. If this option is not given, RELPATH
                                defaults to the current working directory.
                                Use --relative=/ to generate absolute paths.
    
    -c,  --concat               Output the referenced stylesheet files by
                                concatenating them. This is best for plain CSS
                                files. The preprocessor languages can perform such
                                concatenation for you by using @import statements,
                                this is the prefered method because this lets you
                                generate proper source maps for debugging.
    
    -j,  --json                 Output module-deps compatible JSON instead of CSS
    
         --module-deps=SUBARG   Pass options to the "module-deps" module,
                                accepted options are transform and
                                globalTransform:
                                --module-deps [--transform TRANSFORM]
                                Note: shorthands such as "-t" will not work here.

INSTALL:
--------
To install the CLI with [npm](http://npmjs.org) use:

    npm install -g stylerefs

GRUNT:
------
This package also exposes a [grunt](http://gruntjs.com/) task. To install use: 

    npm install stylerefs --save-dev

Here is an example Gruntfile:

```javascript

module.exports = function(grunt)
{
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        stylerefs: {
            options: {
                outputMode: 'import', // or 'concat' or 'json'
                filter: 'less && !mobile', // filter expression
                //filter: function(args) { return args.indexOf('less') >= 0; },
                pathsRelativeTo: '/foo/bar' // default is CWD
            },
            build: {
                src: ['foo.js', 'bar.js'],
                dest: 'generated-web/bundle.less'
            }
        },
        less: {
            options: {
                dumpLineNumbers: 'comments',
                sourceMap: true
            },
            build: {
                src: ['generated-web/bundle.less'],
                dest: 'generated-web/bundle.css'
            }
        }
    });

    grunt.loadNpmTasks('stylerefs');
    grunt.loadNpmTasks('grunt-contrib-less');

    grunt.registerTask('default', ['stylerefs', 'less']);
};

```