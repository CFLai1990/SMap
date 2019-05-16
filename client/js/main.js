require.config({
  shim: {
    'jqueryui': ['jquery'],
    'bootstrap': ['jquery', 'jqueryui'],
    'backbone': {
      deps: ['jquery', 'underscore']
    },
    'MDS': ['numeric'],
    'basicFunctions': ['numeric', 'MDS'],
    'basicViewOperations': ['jquery', 'd3'],
    'data': ['MDS'],
    'datacenter': ['MDS'],
    'SubMap_Model': ['basicFunctions'],
    'Switch': ['jquery', 'bootstrap'],
    'AppView': ['Switch'],
    'tooltip': ['jquery', 'bootstrap'],
    'hexbin': ['d3'],
    'voronoi': ['d3'],
    'SubGlyph': ['d3', 'basicViewOperations'],
    'SubRotate': ['numeric'],
    'HDPainter': ['jquery', 'd3', 'tooltip'],
    'PDHist': ['d3', 'basicViewOperations'],
    'perfectScrollbar': ['jquery'],
    'loadingjs': ['jquery', 'bootstrap'],
    'kruskal': ['union-find'],
    'mst': ['delaunay', 'kruskal']
  },
  paths: {
    // libs loader
    'text': '../bower_components/text/text',
    'jquery': ['../bower_components/jquery/dist/jquery.min'],
    'jqueryui': ['../node_modules/jquery-ui-dist/jquery-ui'],
    'underscore': ['../bower_components/underscore/underscore-min'],
    'bootstrap': ['../bower_components/bootstrap/dist/js/bootstrap.min'],
    'backbone': ['../bower_components/backbone/backbone-min'],
    'marionette': ['../bower_components/backbone.marionette/lib/backbone.marionette.min'],
    'backbone.relational': ['../bower_components/backbone-relational/backbone-relational'],
    'colorjs': ['../bower_components/jscolor/jscolor'],
    'd3': ['../bower_components/d3/d3.min'],
    'hexbin': ['../bower_components/d3-hexbin/hexbin'],
    'voronoi': ['../node_modules/d3-voronoi/build/d3-voronoi'],
    'numeric': ['../bower_components/numericjs/src/numeric'],
    'hull': ['../bower_components/hull-js/dist/hull'],
    'spin': ['../node_modules/spin/dist/spin.min'],
    'combinations': ['../node_modules/combinations-js/amd/index'],
    'PandaMat': ['../bower_components/pandamat/index'],
    'perfectScrollbar': ['../bower_components/perfect-scrollbar/perfect-scrollbar.jquery'],
    'loadingjs': ['../bower_components/loading/loading'],
    'union-find': ['../node_modules/union-find/index'],
    'kruskal': ['../node_modules/kruskal/kruskal'],
    'delaunay': ['../node_modules/delaunay/index'],
    'mst': ['../node_modules/euclideanmst/euclideanmst'],

    't-SNE': 'libs/tsne',
    'Switch': 'libs/bootstrapSwitch',
    'tooltip': 'libs/tooltip',
    'MDS': 'libs/mds',
    'basicFunctions': 'libs/basicFunctions',
    'basicViewOperations': 'libs/basicViewOperations',
    'Tiling': 'libs/tiling',
    'Tiling_v1': 'libs/tiling_v1',
    'SubGlyph': 'libs/subglyph_v0.1',
    'SubRotate': 'libs/subrotate',
    'HDPainter': 'libs/hdpainter',
    'PDHist': 'libs/pandaHist',
    'backbone.routefilter': '../bower_components/backbone.routefilter/dist/backbone.routefilter.min',
    'exportClassFromAMD': '../bower_components/exportClassFromAMD/index',
    // templates path
    'templates': '../templates',
    // controls
    'Router': 'controls/router',
    'Controller': 'controls/controller',
    // models
    'datacenter': 'models/datacenter.model',
    'config': 'models/config.model',
    'variables': 'models/variables.model',
    'data': 'models/data.model',
    'SubMap_Model': 'models/submap.model',
    'SubList_Model': 'models/sublist.model',
    'Projection_Model': 'models/projection.model',
    // collections
    'SubMap_Collection': 'collections/submap_Collection',
    'SubList_Collection': 'collections/sublist_Collection',
    'Projection_Collection': 'collections/projection_Collection_v0.1',
    // views
    'Base': 'views/base.view',
    'AppView': 'views/app.view',
    'SubMap_LayoutView': 'views/submap_Layout.view',
    /*    'SubMap_CollectionView': 'views/submap_Collection.view', */
    /*    'SubMap_CollectionView': 'views/submap_Collection_v0.1.view', */
    'SubMap_CollectionView': 'views/submap_Collection_v0.2.view',
    'SubMap_ModelView': 'views/submap_Model.view',
    'SubList_LayoutView': 'views/sublist_Layout.view',
    'SubList_CollectionView': 'views/sublist_Collection.view',
    'Projection_LayoutView': 'views/projection_Layout.view',
    /*    'Projection_CollectionView': 'views/projection_Collection.view' */
    'Projection_CollectionView': 'views/projection_Collection_v0.2.view'
  }
})

require(['app'], function (App) {
  'use strict'
  var app = new App()
  app.start()
})

// require(['jquery', 'underscore', 'd3'], function ($, _, d3) {
//     'use strict';
//     require(['backbone', 'bootstrap'], function (Backbone, Bootstrap) {
//         require(['app'], function (App) { // require.js shim不能与cdn同用,因此3层require,非amd module需要如此
//             var app = new App();
//             app.start();
//         });
//     });
// });
