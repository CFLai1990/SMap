 define([
    'require',
    'marionette',
    'underscore',
    'jquery',
    'backbone',
    'config',
    'variables',
    'data',
    'SubMap_Collection',
    'Projection_Collection',
    ], function(require, Mn, _, $, Backbone, Config, Variables, Data, SubMap_Collection, Projection_Collection){
        'use strict';

        var dot=numeric.dot, trans=numeric.transpose, sub=numeric.sub, div=numeric.div, clone=numeric.clone, getBlock=numeric.getBlock,
        add=numeric.add, mul=numeric.mul, svd=numeric.svd, norm2=numeric.norm2, identity=numeric.identity, dim=numeric.dim,
        getDiag=numeric.getDiag, inv=numeric.inv, det = numeric.det, norm2Squared = numeric.norm2Squared, norm1 = numeric.norm1;

        return window.Datacenter = new (Backbone.Model.extend({
            defaults: function(){
                return {
                    data: null,
                    distType: null,
                };
            },

            initialize: function(url){
                var self = this;
                this.set("distType", Config.get("distType"));
                var t_default = {
                    ready: false,
                    shown: false,
                    transition: Config.get("transition"),
                };
                _.extend(this, t_default);
                this.data = new Data();
                this.SubMap_Collection = new SubMap_Collection();
                this.Projection_Collection = new Projection_Collection();
                this.bindAll();
            },

            bindAll: function(){
                this.listenTo(this.data, "Data__DataReady", this.updateData);
                this.listenTo(this.SubMap_Collection, "Transmission", this.transmitInfo);
            },

            start: function(){
                this.trigger("DataCenter__initialized");
                this.loadData(Config.get('dataPath'));
            },

            loadData: function(v_path){
                var self = this;
                d3.csv(v_path, function(d){
                    self.data.update({
                        data: d,
                        dimensions: _.allKeys(d[0]),
                        sampling: false,
                    });
                });
            },

            updateData: function(){
                console.info("DataCenter: data ready!");
                var t_cord;
                Config.get("data").array = this.data.dataArray;
                Config.get("data").distances = MDS.getSquareDistances(this.data.dataArray);
                this.Projection_Collection.update();
                this.SubMap_Collection.update({
                    dimensions: this.data.dimensions.values(),
                    dimRange: Config.get("dimRange"),
                    sampleCount: Config.get("sampleCount"),
                });
            },

            transmitInfo: function(v_info){
                var self = this;
                self.trigger(v_info.message, v_info.data);
            },
    }))();
});
