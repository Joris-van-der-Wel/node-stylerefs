'use strict';

var nodePath = require('path');
var Transform = require('readable-stream').Transform;
var nodeResolve = require('resolve');

/**
 * Construct a Transform stream which takes input from module-references and outputs a stylesheet
 * (css,less,scss,stylus,etc)
 * @param {Object} opts
 * @param {string} [opts.outputMode=import] Either "import" or "concat". Using import an @import line is generated for
 *        each file. Using "concat", the content of all referenced files are concatenated.
 * @param {string} [opts.pathsRelativeTo=false] Change the path that all generated file paths are relative to. A falsy
 *        value will make all paths absolute.
 *
 * @returns {StyleRefsStream}
 * @constructor
 * @augments {Transform}
 */
function StyleRefsStream(opts)
{
        if (!opts)
        {
                opts = {};
        }
        
        if (!(this instanceof StyleRefsStream))
        {
                return new StyleRefsStream(opts);
        }
        
        // Something streams a list of referenced files to us (probably module-references)
        
        this.outputMode = opts.outputMode || 'import';

        if (['concat', 'import'].indexOf(this.outputMode) < 0)
        {
                throw Error('Invalid outputMode');
        }
        
        // false = use absolute paths
        this.pathsRelativeTo = opts.pathsRelativeTo || false;
        if (this.pathsRelativeTo && 
            nodePath.resolve(this.pathsRelativeTo) === nodePath.resolve('/'))
        {
                this.pathsRelativeTo = false;
        }
        
        Transform.call(this, {objectMode: true});
        this._readableState.objectMode = false;
        this.setEncoding('utf8');
}

module.exports = StyleRefsStream;
require('inherits')(StyleRefsStream, Transform);

function cssStringEscape(str)
{
        // http://www.w3.org/TR/CSS21/syndata.html#strings
        
        str = str.toString();
        
        return str.replace(/[\\"']/g, '\\$&')
                  .replace(/[\r]/g  , '\\d ') // CR
                  .replace(/[\n]/g  , '\\a ') // LF
                  ;
}

StyleRefsStream.prototype._transform = function(row, encoding, next)
{
        var filePath;
        /* row is in the form of:
        {"id":"somethingunique",
         "file":"/home/joris/foo/bar.css",
         "source":"body { display: none; }",
        }
        */
       
        if (this.outputMode === 'concat')
        {
                if (row.source === undefined || row.source === null)
                {
                        throw Error('Invalid input for this stream, source must be included if outputMode is concat!');
                }
                
                this.push(row.source);
                this.push('\n');
        }
        /* istanbul ignore else : assertion */ 
        else if (this.outputMode === 'import')
        {
                filePath = row.file;
                if (this.pathsRelativeTo)
                {
                        filePath = nodePath.relative(this.pathsRelativeTo, filePath);
                }
                
                // LESS does not like windows style slashes (backslashes)
                // it works for most things, but some features silently fail
                // (such as --relative-urls)
                filePath = filePath.replace(/\\/g, '/');
                
                this.push('@import "', 'utf8');
                this.push(cssStringEscape(filePath), 'utf8');
                this.push('";\n', 'utf8');
        }
        else
        {
                /* istanbul ignore next : assertion */
               throw Error('assertion failed');
        }
        
        next();
};

StyleRefsStream.prototype._flush = function(done)
{
        this.push(null);
        done();
};

/**
 * A resolver that can be passed to module-deps which uses the 'resolve' module instead of the default 'browser-resolve'
 * @param {string} path
 * @param {Object} parent
 * @param {function} cb
 */
StyleRefsStream.moduleResolver = function(path, parent, cb)
{
        nodeResolve(
                path,
                { basedir: nodePath.dirname(parent.filename)},
                function(err, path, packag)
                {
                        if (err)
                        {
                                cb(err, path, packag);
                                return;
                        }

                        if (nodeResolve.isCore(path))
                        {
                                cb(err, null, null);
                                return;
                        }

                        cb(err, path, packag);
                }
        );
};

/**
 * A filter that can be passed to module-deps which filters out all the node.js core modules.
 * @param id e.g. require('id')
 * @returns {boolean} false if the given module should be filtered
 */
StyleRefsStream.coreModuleFilter = function(id)
{
        return !nodeResolve.isCore(id);
};