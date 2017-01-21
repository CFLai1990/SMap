define([
    'require',
    'marionette',
    'underscore',
    'jquery',
    'backbone',
    'config',
    ], function(require, Mn, _, $, Backbone, Config) {
        'use strict';
        var dot=numeric.dot, trans=numeric.transpose, sub=numeric.sub, div=numeric.div, clone=numeric.clone, getBlock=numeric.getBlock,
        add=numeric.add, mul=numeric.mul, svd=numeric.svd, norm2=numeric.norm2, identity=numeric.identity, dim=numeric.dim,
        getDiag=numeric.getDiag, inv=numeric.inv, det = numeric.det, norm2Squared = numeric.norm2Squared, norm1 = numeric.norm1;

        var submap =  Backbone.Model.extend({

            initialize: function(v_options){
                var self = this;
                _.extend(self, {
                    subspace: [],
                    dimensions: null,
                    dimCount: 0,
                    k: Config.get("KNN_K"),
                    dist: null,
                    KNNG: null,
                });
                _.extend(self, v_options);
                self.update();
            },

            update: function () {
                var self = this, t_arr = self.code.split(""), t_dims = d3.set(), t_count = 0;
                for(var i in t_arr){
                    if(t_arr[i] == "0"){
                        t_arr[i] = false;
                    }else{
                        t_count ++;
                        t_arr[i] = true;
                        t_dims.add(self.dimensions[i]);
                    }
                }
                self.subspace = t_arr;
                self.dimensions = t_dims;
                self.dimCount = t_count;
                self.set("dimensions", t_dims);
                var t_data = self.getData();
                // switch(Config.get("distType")){
                //     case "KNN":
                //         self.getKNNG(t_data);
                //     break;
                //     case "Matrix":
                //         self.getMatrix(t_data);
                //     break;
                // }
            },

            getData: function(){
                var self = this, t_data = trans(Config.get("data").array), t_d = [];
                for(var i in self.subspace){
                    if(self.subspace[i]){
                        t_d.push(t_data[i])
                    }
                }
                return trans(t_d);
            },

            getKNNG: function(v_data){
                var self = this;
                if(false){
                    var self = this, t_worker = new Worker('js/libs/KNNG.js');
                    t_worker.postMessage({dist: MDS.getSquareDistances(v_data), k: self.k});
                    t_worker.onmessage = function(event){
                        self.KNNG = event.data;
                        t_worker.terminate();
                        self.collection.sampleFinish(self.id);
                    }
                    t_worker.onerror = function(error){
                        console.log(error.message);
                    }
                }else{
                    self.KNNG = Basic.KNNG(v_data, self.k);
                    self.collection.sampleFinish(self.id);
                }
            },

            getMatrix: function(v_data){//Normalized distance matrix
                var self = this;
                self.dist = div(MDS.getSquareDistances(v_data), Math.sqrt(self.k));
            },
        });
        return submap;
    });
