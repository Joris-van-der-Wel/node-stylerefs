'use strict';

var StyleRefsStream = require('../');
var ModuleDepsStream = require('module-deps');
var ModuleReferencesStream = require('module-references');
var JSONStream = require('JSONStream');
var fs = require('fs');
var nodePath = require('path');

function handleFile(grunt, options, file, done)
{
        var moduleDeps;
        var moduleRefs;
        var stream;

        moduleDeps = ModuleDepsStream(options.moduleDeps);
        stream = moduleDeps;

        moduleDeps.on('missing', function(file, parent)
        {
                grunt.verbose.writeln('Ignoring missing module "' + file +'" required from ' + parent.filename);
        });

        moduleRefs = ModuleReferencesStream({
                // no need to read file content if only @import rules are being generated
                readMode: options.outputMode === 'import' ? false : 'text',
                filter: options.filter
        });

        moduleRefs.on('filtered', function(parentPath, relPath, args)
        {
                grunt.verbose.writeln('Filtered reference "' + relPath + '" (' + args + ')');
        });

        moduleRefs.on('ignoreInput', function(row)
        {
                grunt.verbose.writeln('Ignoring input file', row.file);
        });

        stream = stream.pipe(moduleRefs);

        if (options.outputMode === 'json')
        {
                stream = stream.pipe(JSONStream.stringify());
        }
        else
        {
                stream = stream.pipe(StyleRefsStream({
                        outputMode: options.outputMode,
                        pathsRelativeTo: options.pathsRelativeTo ? options.pathsRelativeTo : process.cwd()
                }));
        }

        try
        {
                stream = stream.pipe(fs.createWriteStream(file.dest, {encoding: 'utf8'}));
        }
        catch(err)
        {
                process.nextTick(function()
                {
                        done(err);
                });

                return;
        }

        stream.on('error', function(error)
        {
                grunt.log.error(error.stack ? error.stack : error.toString());

                if (!(error instanceof Error))
                {
                        error = new Error(error);
                }

                done(error);
        });

        stream.on('finish', function()
        {
                done(null);
        });

        file.src.forEach(function(path)
        {
                path = nodePath.resolve(path);
                grunt.verbose.writeln('Parsing ' + path);
                moduleDeps.write(path);
        });

        moduleDeps.end();
}

function task(grunt)
{
        var options;
        var done;
        var todo, doNext;

        options = this.options({
                moduleDeps: {}, // passed directly to module-deps
                filter: 'css',
                outputMode: 'import', // import / concat / json
                pathsRelativeTo: ''
        });

        done = this.async();

        options.moduleDeps.resolve = StyleRefsStream.moduleResolver;
        options.moduleDeps.filter = StyleRefsStream.coreModuleFilter;
        if (options.moduleDeps.ignoreMissing === undefined)
        {
                // we want a default of true instead of false
                options.moduleDeps.ignoreMissing = true;
        }

        todo = this.files.concat();

        doNext = function(error)
        {
                var file;

                if (error)
                {
                        done(error);
                        return;
                }

                if (todo.length)
                {
                        file = todo.shift();
                        handleFile.call(this, grunt, options, file, doNext);
                }
                else
                {
                        done();
                }

        }.bind(this);

        doNext();
}

module.exports = function (grunt)
{
        grunt.registerMultiTask('stylerefs', 'Grunt task for stylerefs', function()
        {
                task.call(this, grunt);
        });
};