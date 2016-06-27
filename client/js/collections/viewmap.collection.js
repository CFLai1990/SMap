/**
 * Created by Chufan Lai at 2015/12/14
 * model for the viewpoint map
 */
define([
    'require',
    'marionette',
    'underscore',
    'jquery',
    'backbone',
    'viewmap',
], function(require, Mn, _, $, Backbone, Viewmap) {
    'use strict';
    var trans = numeric.transpose, mul = numeric.mul, add = numeric.add;

    var Focus = function(v_options){
        return _.extend(this, v_options);
    };

    var viewmap = Backbone.Collection.extend({
        model: Viewmap,

        initialize: function(){
            var t_defaults = {
                distanceMatrix: [],
                projection: d3.map(),
                focuses: [],
                curID: 0,
                fosID: 0,
                count: 0,
            };
            _.extend(this, t_defaults);
        },

        clearAll: function(){
            this.reset();
            this.curID = 0;
            this.fosID = 0;
            this.count = 0;
            this.focuses = [];
            this.trigger("ViewmapCollection__ClearAllVP");
            this.trigger("ViewmapCollection__ClearAllFocus");
            console.info("ViewmapCollection: clear all viewpoints!");
        },

        InitializeViewpoints: function(v_projection){
        },

        deleteFocus: function(v_focusID){
            this.focuses[v_focusID] = undefined;
            var self = this;
            var t_delCount = 0, t_ids, t_indeces = [];
            self.forEach(function(t_d){
                if(t_d.focusID == v_focusID){
                    t_delCount++;
                    if(!t_ids)
                        t_ids = t_d.id + '';
                    else
                        t_ids += (", " + t_d.id);
                    t_indeces.push(t_d.id);
                }
            });
            for(var i in t_indeces){
                self.remove(self.get(t_indeces[i]));
            }
            self.count -= t_delCount;
            self.updateDistanceMatrix();
            console.info("ViewmapCollection: remove viewpoint " + t_ids + "!");
            self.trigger("ViewmapCollection__UpdateViewmap", null, v_focusID, null);
        },

        deleteViewpoint: function(v_vp){
            console.info("ViewmapCollection: remove viewpoint " + (v_vp.id) + "!");
            var self = this;
            self.focuses[v_vp.focusID].coordinates[v_vp.optimization] = null;
            self.remove(v_vp);
            self.count--;
            self.updateDistanceMatrix();
            self.trigger("ViewmapCollection__UpdateViewmap", null, null, null);
        },

        addFocus: function(v_focus){
            var self = this, t_id = self.fosID, t_name = (v_focus.group.length==0?"All Data":null), t_sameFocus = false;
            self.focuses.forEach(function(t_d, t_i){
                if(!t_d)
                    return;
                if(self.compareFocus(t_d.group, v_focus.group)){
                    t_sameFocus = true;
                }
            });
            if(t_sameFocus){
                return null;
            }
            var t_focus = new Focus({
                group: v_focus.group,
                name: v_focus.name?v_focus.name:(t_name?t_name:("Focus "+(t_id))),
                ID: t_id,
                color: v_focus.color,
                coordinates: {
                    Expand: null,
                    Compress: null,
                    Separate: null,
                },
            });
            this.focuses[self.fosID] = t_focus;
            this.trigger("ViewmapCollection__AddFocus", t_focus);
            self.fosID++;
            return t_id;
        },

        addViewpoint: function(v_focus, v_cord, v_opti){
            var self = this;
            if(self.count>0 && v_focus.length == 0){
                if(self.focuses[0]['Expand'] && self.focuses[0]['Compress'])
                    return false;
            }
            var t_sameFocus = false, t_sameOpti = false, t_fosID, t_sameID;
            self.focuses.forEach(function(t_d, t_i){
                if(!t_d)
                    return;
                if(self.compareFocus(t_d.group, v_focus)){
                    t_sameFocus = true;
                    if(t_d.coordinates[v_opti]){
                        t_sameOpti = true;
                        t_sameID = t_d.id;
                    }else{
                        t_d.coordinates[v_opti] = v_cord;
                        t_fosID = t_d.ID;
                    }
                }
            });
            if(t_sameFocus == true){
                if(t_sameOpti){
                    alert("Viewpoint Already Exists!");
                    self.trigger("ViewmapCollection__highlightViewpoint", t_sameID);
                    return false;
                }
            }else{
                t_fosID = self.fosID;
                self.addFocus({
                    group: v_focus,
                    name: v_focus.length==0?"All Data":("Focus "+(t_fosID-1)),
                });
            }
            var t_focus = self.focuses[t_fosID];
            self.add({id: self.curID, focusID: t_fosID, focus: v_focus, coordinates: v_cord, optimization: v_opti, name: t_focus.name, color: t_focus.color});
            self.curID++;
            self.count++;
            console.info("ViewmapCollection: add viewpoint " + (self.curID-1) + "!");
            self.updateDistanceMatrix();
            self.trigger("ViewmapCollection__UpdateViewmap", self.get(self.curID-1), null, v_cord);
            return true;
        },

        compareFocus: function(v_f1, v_f2){
            var t_sign = false;
            if(v_f1.length == v_f2.length){
                t_sign = true;
                for(var i in v_f1){
                    if(v_f2.indexOf(v_f1[i]) <0){
                        t_sign = false;
                    }
                }
            }
            return t_sign;
        },

        updateDistanceMatrix: function(){
            var self = this, t_count = this.count, t_disMatrix = [], t_models = this.models;
            if(t_count>2){
                var t_cords = _.map(t_models, "coordinates");
                this.trigger("ViewmapCollection__UpdateProjection", t_cords);
            }else{
                self.getProjection(null);
            }
        },

        getProjection: function(v_projection){
            var self = this, t_models = this.models;
            if(this.count<3){
                if(this.count == 1){
                    t_models[0].position = [0.5,0.5]
                }
                if(this.count == 2){
                    t_models.forEach(function(t_d){
                        if(t_d.optimization == "Expand"){
                            t_d.position = [0.2, 0.5];
                        }else{
                            t_d.position = [0.8, 0.5];
                        }
                    });
                }
            }else{
                var t_projection = self.matchProjection(v_projection);
                t_projection.forEach(function(t_d, t_i){
                    t_models[t_i].position = t_d;
                });
            }
        },

        matchProjection: function(v_projection){
            var t_models = this.models;
            var t_pos = [0, 0, 0, 0, 0, 0, 0, 0];
            // console.log(_.map(t_models, "position"));
            // console.log(v_projection);
            for(var i = 0; i<2; i++){
                var t_i = Math.pow(-1, i ), t_a = (i==0?0:1);
                for(var j = 0; j < 2; j++){
                    var t_j = Math.pow(-1, j), t_b = (j==0?0:1);
                    for(var k = 0; k < t_models.length; k++){
                        var tt_pos = t_models[k].position;
                        if(tt_pos.length > 0){
                            t_pos[2*i + j] += (Math.abs(tt_pos[0] - v_projection[k][0] * t_i - t_a) + Math.abs(tt_pos[1] - v_projection[k][1] * t_j - t_b));
                        }
                    }
                }
            }
            for(var i = 0; i<2; i++){
                var t_i = Math.pow(-1, i );
                for(var j = 0; j < 2; j++){
                    var t_j = Math.pow(-1, j);
                    for(var k = 0; k < t_models.length; k++){
                        var tt_pos = t_models[k].position;
                        if(tt_pos.length > 0){
                            t_pos[2*i + j + 4] += (Math.abs(tt_pos[0] - v_projection[k][1] * t_i - t_a) + Math.abs(tt_pos[1] - v_projection[k][0] * t_j - t_b));
                        }
                    }
                }
            }
            // console.log(t_pos);
            var t_ind = t_pos.indexOf(d3.min(t_pos)), t_projection = trans(v_projection);
            var tt_ind = t_ind>=4?(t_ind-4):t_ind, t_i = ~~(tt_ind/2), t_j = tt_ind % 2;
            var t_proj_x, t_proj_y;
            // console.log(t_ind);
            if(t_ind < 4){
                t_proj_x = t_projection[0];
                t_proj_y = t_projection[1];
                t_projection = [mul(t_projection[0], Math.pow(-1, t_i)), mul(t_projection[1], Math.pow(-1, t_j))];
            }else{
                t_proj_x = t_projection[1];
                t_proj_y = t_projection[0];
                t_projection = [mul(t_projection[1], Math.pow(-1, t_i)), mul(t_projection[0], Math.pow(-1, t_j))];
            }
            if(t_i == 1){
                t_proj_x = add(mul(t_proj_x, -1),1);
            }
            if(t_j == 1){
                t_proj_y = add(mul(t_proj_y, -1),1);
            }
            t_projection = [t_proj_x, t_proj_y];
            return trans(t_projection);
        },

        changeFocusColor: function(v_id, v_col){
            this.focuses[v_id].color = v_col;
            this.trigger("ViewmapCollection__changeFocusColor", {id: v_id, color: v_col});
        },

        cancelFocusColor: function(){
            this.trigger("ViewmapCollection__changeFocusColor", {id: null, color: null});
        },

        changeFocusTitle: function(v_id, v_text){
            this.focuses[v_id].name = v_text;
            this.trigger("ViewmapCollection__changeFocusTitle", {id: v_id, title: v_text});
        },

        cancelFocusTitle: function(){
            this.trigger("ViewmapCollection__changeFocusTitle", {id: null, title: null});
        },

        releaseFocus: function(){
            this.trigger("ViewmapCollection__ReleaseFocus");
        },

        clearShown: function(){
            this.trigger("ViewmapCollection__ClearShown");
        },
    });
    return viewmap;
});
