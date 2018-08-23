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
   'SubList_Collection',
   'Projection_Collection',
   'PandaMat',
   ], function(require, Mn, _, $, Backbone, Config, Variables, Data, SubMap_Collection, SubList_Collection, Projection_Collection, PandaMat) {
     'use strict';

     let dot = numeric.dot,
     trans = numeric.transpose,
     sub = numeric.sub,
     div = numeric.div,
     clone = numeric.clone,
     getBlock = numeric.getBlock,
     add = numeric.add,
     mul = numeric.mul,
     svd = numeric.svd,
     norm2 = numeric.norm2,
     identity = numeric.identity,
     dim = numeric.dim,
     getDiag = numeric.getDiag,
     inv = numeric.inv,
     det = numeric.det,
     norm2Squared = numeric.norm2Squared,
     norm1 = numeric.norm1;

     return window.Datacenter = new(Backbone.Model.extend({
       defaults: function() {
         return {
           data: null,
           distType: null,
         };
       },

       initialize: function(url) {
         let self = this;
         this.set("distType", Config.get("distType"));
         let t_default = {
           ready: false,
           shown: false,
           transition: Config.get("transition"),
         };
         _.extend(this, t_default);
         this.data = new Data();
         this.SubMap_Collection = new SubMap_Collection();
         this.SubList_Collection = new SubList_Collection();
         this.Projection_Collection = new Projection_Collection();
         this.bindAll();
       },

       bindAll: function() {
         this.listenTo(this.data, "Data__DataReady", this.updateData);
         this.listenTo(this.data, "Data__Panda", this.panda);
         this.listenTo(this.SubMap_Collection, "SubMapCollection__Panda", this.panda);
         this.listenTo(this.SubMap_Collection, "Transmission", this.transmitInfo);
         this.listenTo(this.SubMap_Collection, "change:currentCls", this.transmitInfo);
         this.listenTo(this.SubList_Collection, "Transmission", this.transmitInfo);
         this.listenTo(this.Projection_Collection, "ProjectionCollection__Panda", this.panda);
         this.listenTo(this.Projection_Collection, "Transmission", this.transmitInfo);
       },

       start: function() {
         this.trigger("DataCenter__initialized");
         this.loadData(Config.get('dataPath'));
       },

       loadData: function(v_path) {
         var self = this;
         d3.csv(v_path, function(d) {
           self.data.update({
             data: d,
             dimensions: _.allKeys(d[0]),
             sampling: false,
           });
         });
       },

       updateData: function() {
         console.info("DataCenter: data ready!");
         var t_cord;
         Config.get("data").array = this.data.dataArray;
         Config.get("data").distances = MDS.getSquareDistances(this.data.dataArray);
         this.Projection_Collection.update();
         this.SubList_Collection.update();
         this.SubMap_Collection.update({
           dimensions: this.data.dimensions.values(),
           dimRange: Config.get("dimRange"),
           sampleCount: Config.get("sampleCount"),
         });
       },

       transmitInfo: function(v_info) {
         this.trigger(v_info.message, v_info.data);
       },

       requireFrom: function(v_source, v_attr) {
         return this[v_source][v_attr];
       },

       listenAndTrigger: function(v_source, v_attr, v_message) {
         this.listenTo(this[v_source], "change:" + v_attr, () => {
           this.trigger(v_message, this[v_source][v_attr]);
         });
       },

       panda: function(v_data, v_command, v_callback, v_glb = true, v_return = false) {
         let t_command = v_command;
         console.time(`PandaMat ${v_command}`);
         PandaMat.compute({
           panda: {
             data: v_data,
             command: v_command,
             global: v_glb,
             return: v_return,
           },
           sucess: function(v_result) {
             console.timeEnd(`PandaMat ${v_command}`);
             v_callback(v_result);
           },
           error: function(v_message) {
             console.timeEnd(`PandaMat ${v_command}`);
             console.error(v_message);
           },
         });
       },
     }))();
   });
