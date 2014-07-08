/* jshint node:true */

'use strict';

// # Globbing
// for performance reasons we're only matching one level down:
// 'test/spec/{,*/}*.js'
// use this if you want to recursively match all subfolders:
// 'test/spec/**/*.js'

module.exports = function (grunt) {

  var bannerContent = '/*! <%= pkg.name %> v<%= pkg.version %> - ' +
                      '<%= grunt.template.today("yyyy-mm-dd") %> \n' +
                      ' * License: <%= pkg.license %> */\n' +
                      '\'use strict\';\n' +
                      '(function(exports){\n' +
                      'var oscope = exports.oscope = {version: "<%= pkg.version %>"};\n';

  var name = '<%= pkg.name %>-v<%= pkg.version %>';
  var latest = '<%= pkg.name %>';
  var footerContent = '})(this);';
  var srcFiles = [
    'src/id.js',
    'src/identity.js',
    'src/option.js',
    'src/modularTimeScale.js',
    'src/context.js',
    'src/metric.js',
    'src/metric-constant.js',
    'src/metric-operator.js',
    'src/oscope.js',
    'src/comparison.js',
    'src/axis.js',
    'src/rule.js' 
    ];
  var specFiles = 'test/spec/**/*.js';

  // Load grunt tasks automatically
  require('load-grunt-tasks')(grunt);

  // Time how long tasks take. Can help when optimizing build times
  require('time-grunt')(grunt);

  // Define the configuration for all the tasks
  grunt.initConfig({

    // Project settings
    pkg: grunt.file.readJSON('package.json'),

    concat: {
      options: {
        banner: bannerContent,
        footer: footerContent
      },
      target : {
        src : [ srcFiles ],
        dest : name + '.js'
      }
    },

    uglify: {
      options : {
        banner: bannerContent,
        footer: footerContent
      },
      target : {
        src : [ srcFiles ],
        dest : name + '.min.js'
      }
    },


    // Make sure code styles are up to par and there are no obvious mistakes
    jshint: {
      options: {
        jshintrc: '.jshintrc',
        reporter: require('jshint-stylish')
      },
      all: [
        'Gruntfile.js',
        'oscope.js'
      ],
      test: {
        options: {
          jshintrc: 'test/.jshintrc'
        },
        src: [ specFiles ]
      }
    },

    // Empties folders to start fresh
    clean: {
      dist: {
        files: [{
          dot: true,
          src: [
            '.tmp',
            'dist/*',
            '!dist/.git*'
          ]
        }]
      },
      server: '.tmp'
    },

    copy: {
      development: {
        src: name + '.js',
        dest: latest + '.js'
      },
      minified:{
        src: name + '.min.js',
        dest: latest + '.min.js'
      }
    },

    watch: {
      src: {
        files: [ srcFiles, 'Gruntfile.js' ],
        tasks: ['build', 'jshint'  ]
      }
    },

    // Test settings
    karma: {
      e2e: {
        configFile: 'karma-e2e.conf.js',
        singleRun: true
      },
      unit: {
        configFile: 'karma.conf.js',
        singleRun: false
      }
    }
  });


  grunt.registerTask('serve', function (target) {
    if (target === 'dist') {
      return grunt.task.run(['build', 'connect:dist:keepalive']);
    }

    grunt.task.run([
      'clean:server',
      'bowerInstall',
      'concurrent:server',
      'autoprefixer',
      'connect:livereload',
      'watch'
    ]);
  });

  grunt.registerTask('test:unit', [
    'clean:server',
    'karma:unit'
  ]);

  grunt.registerTask('test:e2e', [
    'clean:server',
    'karma:e2e'
  ]);

  grunt.registerTask('build', [
    'clean:dist',
    'concat',
    'uglify',
    'copy'
  ]);

  grunt.registerTask('default', [
    'build',
    'watch'
  ]);
};