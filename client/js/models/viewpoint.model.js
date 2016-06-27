/**
 * Created by Chufan Lai at 2015/12/14
 * model for each viewpoint projection
 */
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
        getDiag=numeric.getDiag, inv=numeric.inv;

    var viewpoint =  Backbone.Model.extend({

        initialize: function(v_options){
            var t_defaults = {
                id: null,
                center: null,
                dimensions: null,
                dimNumber: null,
                dataNumber: null,
                coordinates: null,
                optimization: null,
                projection: null,
                vectors: null,
                distances: null,
                errors: null,
                div_err: null,
                order: null,
                focus: null,
                basis1: null,
                basis2: null,
                frames: 10,
                nowFrame: 0,
                timer: null,
                index: null,
                mustChange: false,
                transCoordinates: [],
                interval: Config.get("transition").interval,
                fontSize: Config.get("fontSize"),
                clusters: null,
                clusterCords: [],
                clusterDensity: 7,
                modifies: {
                    Add: null,
                    Minus: null,
                },
                modifyCords: {
                    Add: null,
                    Minus: null,
                },
                modifyCount: 0,
            };
            _.extend(this, t_defaults);
            _.extend(this, v_options);
            this.dimensions = Config.get("data").dimensions;
            this.dimNumber = this.dimensions.size();
        },

        update: function(){
            this.trigger("Viewpoint__DataUpdate");
        },

        updateDensityParameters: function(v_dist, v_range){
            var t_sum = 0;
            for(var i in v_dist){
                var t_count = 0;
                var t_d = v_dist[i];
                t_d.sort();
                for(var j in t_d){
                    if(t_d[j] <= v_range){
                        t_count++;
                    }else{
                        break;
                    }
                }
                t_sum += t_count;
            }
            t_sum = t_sum / t_d.length;
            return Math.round(t_sum);
        },

        getProjection: function(v_cord, v_proj, v_vp){
            this.focus = v_vp;
            this.coordinates = v_cord;
            this.projection = v_proj;
            this.getVectors(v_cord);
            this.updateDistances(v_proj, v_cord);
            this.updateGroupSuggestion(v_proj);
            this.updateGroupModify(v_proj);
            this.trigger("Viewpoint__ProjectionUpdate", true, v_cord);
            // this.showErrors(v_vp);
            // this.trigger("Viewpoint__SortPoints");
        },

        updateDistances: function(v_proj, v_cord){
            var t_originDist = Config.get("data").distances, t_data = Config.get("data").array, t_dist = [], t_cord = trans(v_cord);
            var t_errors = [];
            this.distances = [], this.dataNumber = v_proj.length;
            for(var i = 0; i < this.dataNumber; i++){
                this.distances.push([]);
                t_errors.push(0);
                // var t_d = {id: i, d: norm2(sub(dot([v_proj[i]], t_cord), [t_data[i]]))};
                // t_dist.push(t_d);
            }
            // t_dist.sort(function(a,b){
            //     return a.d - b.d;
            // });
            // this.order = _.map(t_dist, "id");
            for(var i  = 0; i < this.dataNumber-1; i++){
                this.distances[i][i] = 0;
                for(var j  = i+1; j < this.dataNumber; j++){
                    this.distances[i][j] = this.distances[j][i] = numeric.norm2(numeric.sub(v_proj[i], v_proj[j]));
                    var t_err;
                    if(t_originDist[i][j] == 0)
                        t_err = 0;
                    else{
                        //Seperate two views
                        // if(this.state=="before")
                        //     t_err = t_originDist[i][j];
                        // else
                        //     t_err = this.distances[i][j];

                        //Propotilnal Loss
                        // t_err = 1 - this.distances[i][j] / t_originDist[i][j];

                        //Absolute Loss
                        // t_err = t_originDist[i][j] - this.distances[i][j];

                        //Traditional Definition
                        // t_err = Math.abs(Math.sqrt(t_originDist[i][j]) - Math.sqrt(this.distances[i][j]));
                        t_err = Math.pow((t_originDist[i][j] - this.distances[i][j]),2);
                    }
                    t_errors[i] += t_err;
                    t_errors[j] += t_err;
                }
            }
            t_errors = numeric.div(t_errors, this.dataNumber-1);
            if(this.errors){
                this.div_err = numeric.sub(t_errors, this.errors);
            }
            this.errors = t_errors;
        },

        updateGroupSuggestion: function(v_data){
            var t_range = this.getClusteringParameters(v_data);
            t_range = t_range.range;
            var t_density = t_range.density;
            var t_dbscan = new DBSCAN();
            var tt_clusters = this.clusters = t_dbscan.run(v_data, t_range, t_density);//this.clusterDensity
            tt_clusters = this.clusters = this.trimClusters(tt_clusters);
            this.trigger("Viewpoint__GetClusterCord", tt_clusters);
            return tt_clusters;
        },

        trimClusters: function(v_clusters){
            var t_cls = [];
            for(var i in v_clusters){
                if(v_clusters[i].length >= this.dimNumber)
                    t_cls.push(v_clusters[i]);
            }
            return t_cls;
        },

        updateGroupModifyPaths: function(){
            this.trigger("Viewpoint__drawGroupModify");
        },

        updateGroupModify: function(v_proj){
            if(this.focus.length > 1){
                var t_data = [], t_indeces = [], tt_indeces = [];
                for(var i in this.focus){
                    t_data.push(v_proj[this.focus[i]]);
                    t_indeces.push(this.focus[i]);
                }
                for(var i = 0; i < v_proj.length; i++){
                    tt_indeces.push(i+"");
                }
                var t_range = this.getClusteringParameters(t_data), t_extent = t_range.extent;
                t_range = t_range.range;
                if(t_range < 1e-10) t_range = 1e-10;
                this.modifies["Minus"] = this.getCluster(t_indeces, t_data, t_range);//Identify small sub-clusters
                var t_add = this.getCluster(tt_indeces, v_proj, t_range);//Add more points
                this.modifies["Add"] = this.intersection(t_add, this.focus);
                this.modifyCount = 0;
                this.trigger("Viewpoint__GetModifyCord", this.modifies["Add"], "Add");
                this.trigger("Viewpoint__GetModifyCord", this.modifies["Minus"], "Minus");
            }
        },

        getCluster: function(v_indeces, v_data, v_range){
                var t_dbscan = new DBSCAN(), t_modify = [];
                var tt_clusters = t_dbscan.run(v_data, v_range, this.clusterDensity);
                for(var i in tt_clusters){
                    var t_mod = tt_clusters[i], tt_modify = [];
                    for(var j in t_mod){
                        tt_modify.push(v_indeces[t_mod[j]]);
                    }
                    t_modify.push(tt_modify);
                }
                return t_modify;
        },

        intersection: function(a, b){
            var t_result = [];
            for(var i in a){
                var t = a[i], t_sign = false;
                for(var j in t){
                    if(b.indexOf(t[j]) >= 0){
                        t_sign = true;
                        break;
                    }
                }
                if(t_sign){
                    t_result.push(t);
                }
            }
            return t_result;
        },

        getClusterCord: function(v_cords){
            var t_clusterCords = [];
            for(var i in v_cords){
                var t_weights = [], t_cord = v_cords[i];
                for(var j in t_cord){
                    var t_score = numeric.norm2Squared(t_cord[j]) / 2;
                    t_weights[j] = t_score;
                }
                t_clusterCords[i] = t_weights;
            }
            this.clusterCords = t_clusterCords;
            this.trigger("Viewpoint__UpdateClusterInfo", v_cords);//Cords for clusters
        },

        getModifyCord: function(v_cords, v_type){
            var t_clusterCords = [];
            for(var i in v_cords){
                var t_weights = [], t_cord = v_cords[i];
                for(var j in t_cord){
                    var t_score = numeric.norm2Squared(t_cord[j]) / 2;
                    t_weights[j] = t_score;
                }
                t_clusterCords[i] = t_weights;
            }
            this.modifyCords[v_type] = t_clusterCords;
            this.modifyCount ++;
            if(this.modifyCount == 2){
                this.modifyCount = 0;
                this.trigger("Viewpoint__UpdateModifyInfo");//Cords for modifications
            }
        },

        getClusteringParameters: function(v_data){
            var t_dist = MDS.getSquareDistances(v_data), t_distArray = [], t_range = 0, t_n = this.clusterDensity, t_sum, t_extent;
            for(var i in t_dist){
                var t_d = t_dist[i].slice(0);
                t_d.sort();
                t_range += t_d[t_n];
                if(!t_sum){
                    t_sum = t_d;
                }else{
                    t_sum = add(t_sum, t_d);
                }
            }
            t_sum = div(t_sum, t_dist.length);
            // t_range = t_range / t_dist.length * 1.2;
            if(t_dist.length >= t_n){
                t_range = t_sum[t_n] * 1.05;
                var t_density = this.updateDensityParameters(t_dist, t_range);//this.clusterDensity
                t_extent = d3.extent(t_dist[t_n]);
            }else{
                t_range = t_sum[t_sum.length-1] * 1.05;
                var t_density = t_sum.length;
                t_extent = d3.extent(t_dist[t_dist.length-1]);
            }
            return {range: t_range, extent: t_extent, density: t_density};
        },

        updateCoordinates: function(v_data, v_cord, v_vp, v_opti){
            var self = this;
            this.basis1 = this.coordinates;
            this.coordinates = v_cord;
            this.optimization = v_opti;
            this.basis2 = v_cord;
            if(self.basis1){
                var t_diff = self.getTransform();
                if(isNaN(this.basis2[0][0])){
                    // Config.set("test", {basis1: this.basis1, basis2: v_cord});
                    console.group("Error: NaN");
                    console.error("Viewpoint from:");
                    console.table(this.basis1);
                    console.error("To:");
                    console.table(v_cord);
                    console.groupEnd();
                }
                if(!t_diff){
                    self.coordinates = clone(self.basis1);
                    self.focus = v_vp;
                    self.updateGroupModify(self.projection);
                    self.updateGroupModifyPaths();
                    self.trigger("Viewpoint__FocusUpdate");
                    if(self.mustChange){
                        self.mustChange = false;
                        self.trigger("Viewpoint__AxesUpdate");
                    }
                    return;
                }else{
                    self.mustChange = false;
                    self.nowFrame = 0;
                    clearInterval(self.timer);
                    var tt_proj = dot(v_data, self.basis2);
                    self.updateDistances(tt_proj, self.basis2);
                    self.updateGroupSuggestion(tt_proj);
                    // self.showErrors(v_vp);
                    self.focus = v_vp;
                    self.updateGroupModify(tt_proj);
                    self.timer = setInterval(function(){
                        self.coordinates = self.transCoordinates[self.nowFrame];
                        self.projection = dot(v_data, self.coordinates);
                        self.getVectors(self.coordinates);
                        // if(v_vp.length > 0)    self.viewpoint = dot(v_vp, self.coordinates);
                        self.trigger("Viewpoint__ProjectionUpdate", (self.nowFrame == 0), (self.nowFrame == 0?self.transCoordinates[self.frames - 1]:null));
                        if(self.nowFrame == self.frames - 1){
                            clearInterval(self.timer);
                            self.nowFrame = 0;
                            // self.trigger("Viewpoint__SortPoints");
                        }
                        self.nowFrame = self.nowFrame+1;
                    }, self.interval);
                }
            }
        },

        getTransform: function(){
            var self = this; self.transCoordinates = [];
            var B=[], inds=[], angles=[], is=[], t_different=false, same_inds=[], same_angles=[];
            var t = svd(dot(trans(self.basis1), self.basis2));
            var G1=trans(dot(self.basis1, t.U)), G2=trans(dot(self.basis2, t.V));
            var rotG2=dot(t.V,trans(t.U));
            if(Math.pow(rotG2[0][0]-rotG2[1][1], 2)>0.000001 ||
                rotG2[1][0]*rotG2[0][1]>0){
                var t_basis=trans(self.basis2);
                t_basis=[t_basis[1],t_basis[0]];
                self.basis2=clone(trans(t_basis));
                t = svd(dot(trans(self.basis1), self.basis2));
                G1=trans(dot(self.basis1, t.U)), G2=trans(dot(self.basis2, t.V));
                rotG2=dot(t.V,trans(t.U))
            }
            for(var i in t.S){
                B.push(G1[i]);
                if(Math.abs(t.S[i])<1-1e-10){
                    t_different=true;
                    var g=sub(G2[i], mul(G1[i], div(dot(G1[i], G2[i]), dot(G1[i], G1[i]))));//orthogonalize
                    g=div(g, norm2(g));
                    B.push(g);
                    is.push(i);
                    same_inds.push([B.length-2, B.length-1]);
                    inds.push([B.length-2, B.length-1]);
                    angles.push(Math.acos(t.S[i]));
                    same_angles[i]=Math.acos(t.S[i]);
                }else{
                    same_inds.push(i);
                }
            }
            if(!t_different){
                self.basis2 = clone(self.basis1);
                for(var j = 0; j < self.frames; j++){
                    self.transCoordinates.push(self.basis2);
                }
                return t_different;
            }
            {
                var t_signs=[],t_basis=[],t_starts=[],t_ends=[];
                for(var i=0; i<same_inds.length; i++){
                    if(same_inds[i].length==1){
                        t_basis.push(B[same_inds[i]]);
                        continue;
                    }
                    t_starts[i]=B[same_inds[i][0]], t_ends[i]=B[same_inds[i][1]];
                    var tg1=add(mul(t_starts[i],Math.cos(same_angles[i])),mul(t_ends[i],Math.sin(same_angles[i]))),
                    tg2=G2[i];
                    t_signs[i]=norm2(sub(tg2,tg1))<0.000001?1:-1;
                    t_basis.push(t_starts[i]);
                }
                for(var j=0; j<self.frames; j++){
                    for(var i=0; i<same_inds.length; i++){
                        if(same_inds[i].length==1){
                            continue;
                        }
                        var t_ang=(j+1)/self.frames*same_angles[i];
                        t_basis[i]=add(mul(t_starts[i],Math.cos(t_ang)),mul(t_ends[i],t_signs[i]*Math.sin(t_ang)));
                    }
                    var t_b=dot(t.U,t_basis);
                    t_b=trans(t_b);
                    if(j==self.frames - 1){
                        // console.log(norm2(sub(t_basis,G2)));
                        self.optimizeData(t_b);
                        self.basis2 = clone(t_b);
                    }
                    self.transCoordinates.push(t_b);
                }
            }
            return t_different;
        },

        optimizeData: function(v_data){
            for(var i in v_data){
                for(var j in v_data[i]){
                    var t = v_data[i][j];
                    if(Math.abs(t) < 1e-10){
                        v_data[i][j] =0;
                    }
                }
            }
        },

        showErrors: function(v_vp){
            if(this.state == "shown" && v_vp){
                this.collection.showErrors(v_vp, this.errors);//this.div_err?this.div_err:this.errors
            }
        },

        getVectors: function(v_cord){
            var t_cords = Config.get("data").vectors, t_vectors = [], t_proj = this.projection;
            for(var i in t_cords){
                t_vectors[i] = dot(t_cords[i], v_cord);
            }
            this.vectors = t_vectors;
        },

        getReady: function(){
            this.mustChange = true;
        },

    });
    return viewpoint;
});
