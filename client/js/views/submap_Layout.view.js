define([
    'require',
    'marionette',
    'underscore',
    'jquery',
    'backbone',
    'd3',
    'Base',
    'SubMap_CollectionView',
    'datacenter',
    'text!templates/submap_Layout.tpl'
], function(require, Mn, _, $, Backbone, d3, Base, SubMap_CollectionView, Datacenter, Tpl){
    'use strict';
    return Mn.LayoutView.extend(_.extend({

        tagName:'svg',

        template: _.template(Tpl),

        regions:{
            'SubMap_CollectionView':'#SubMap_CollectionView',
        },

        attributes:{
            'id':'SubMap_CollectionViewSVG',
            'width': '100%',
            'height': '100%',
        },

        initialize: function(){
            var self = this;
            var t_defaults = {
                width: null,
                height: null,
            };
            _.extend(this, t_defaults);
        },

        onShow: function(){
            var self = this;
            self.width = self.$el.width();
            self.height = self.$el.height();
                        var t_layout = {
                           width: this.width,
                         height: this.height,
                      };
                      _.extend(Config.get("childviewLayout"), t_layout);
            self.showChildView('SubMap_CollectionView', new SubMap_CollectionView({collection: Datacenter.SubMap_Collection}));
        },

    }, Base));
});