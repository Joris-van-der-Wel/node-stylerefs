#!/usr/bin/env node
'use strict';

var StyleRefsStream = require('../');
var ModuleDepsStream = require('module-deps');
var ModuleReferencesStream = require('module-references');
var subarg = require('subarg');
var fs = require('fs');
var path = require('path');
var JSONStream = require('JSONStream');

function command(argv, stdin, stdout, cwd)
{
        var moduleDeps;
        var moduleDepsOpts;
        var moduleRefs;
        var outputMode;
        var stream;
        
        argv = subarg(argv.slice(2), {
                alias: {
                        '?': 'help',
                        h: 'help',
                        f: 'filter',
                        i: 'import',
                        c: 'concat',
                        j: 'json',
                        v: 'verbose'
                }
        });

        if (argv.help || !argv._.length)
        {
                fs.createReadStream(__dirname + '/usage.txt').pipe(stdout);
                return;
        }

        // module-deps //
        moduleDepsOpts = argv['module-deps'] || {};
        
        moduleDepsOpts.resolve = StyleRefsStream.moduleResolver;
        moduleDepsOpts.filter = StyleRefsStream.coreModuleFilter;
        if (moduleDepsOpts.ignoreMissing === undefined)
        {
                // we want a default of true instead of false
                // Use --module-deps [ --ignoreMissing=0 ] to disable
                moduleDepsOpts.ignoreMissing = true;
        }
        moduleDeps = ModuleDepsStream(moduleDepsOpts);
        stream = moduleDeps;

        if (argv.verbose)
        {
                moduleDeps.on('missing', function(file, parent)
                {
                        // stderr
                        console.warn('*** Ignoring missing module "' + file +'" required from ' + parent.filename);
                });
        }

        // module-references //
        if (!argv.filter)
        {
                argv.filter = function(args)
                {
                        return args.indexOf('css') >= 0;
                };
        }
        
        outputMode = 'import';
        
        if (argv.json)
        {
                outputMode = 'json';
        }
        else if (argv.concat)
        {
                outputMode = 'concat';
        }
        // else if (argv.import)
        
        moduleRefs = ModuleReferencesStream({
                // no need to read file content if only @import rules are being generated
                readMode: outputMode === 'import' ? false : 'text',
                filter: argv.filter
        });
        
        if (argv.verbose)
        {
                moduleRefs.on('filtered', function(parentPath, relPath, args)
                {
                        console.warn('*** Filtered reference', relPath, '(', args,')');
                });

                moduleRefs.on('ignoreInput', function(row)
                {
                        console.warn('*** Ignoring input file', row.file);
                });
        }

        stream = stream.pipe(moduleRefs);
        
        
        // json / stylerefs //
        if (outputMode === 'json')
        {
                stream = stream.pipe(JSONStream.stringify());
        }
        else
        {
                stream = stream.pipe(StyleRefsStream({
                        outputMode: outputMode,
                        pathsRelativeTo: argv.relative ? argv.relative : cwd
                }));
        }

        
        stream = stream.pipe(stdout);

        argv._.forEach(function(file)
        {
                if (file === '-')
                {
                        file = stdin;
                }
                else
                {
                        file = path.resolve(file);
                }
                
                moduleDeps.write(file);
        });
        
        moduleDeps.end();
}

module.exports = command;

if (require.main === module)
{
        command(process.argv, process.stdin, process.stdout, process.cwd());
}
