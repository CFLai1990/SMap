var _ = require("underscore"), numeric = require("numeric"), Q = require("q");
var MDS = require("../../node_modules/mds.js");
var t_sort = function(v_array, v_key){
    return _.sortBy(v_array, v_key);
}

// $.whenWithProgress = function(arrayOfPromises, progressCallback) {
//    var cntr = 0;
//    for (var i = 0; i < arrayOfPromises.length; i++) {
//        arrayOfPromises[i].done(function() {
//            progressCallback();
//        });
//    }
//    return jQuery.when.apply(jQuery, arrayOfPromises);
// }

function initialize(v_db, v_logger){
	logger = v_logger;
	return this;
}

function barchart(v_callback, v_parameters){
	return function(v_data){
		var t_key = v_parameters.key, t_bins = v_parameters.bins;
		var t_data = t_sort(v_data, t_key);
		var t_min = t_data[0][t_key], t_max = t_data[t_data.length - 1][t_key];
        var t_binRange = (t_max - t_min)/t_bins;
        var t_binCount = [];
        for(var i = 0; i < t_bins; i++){
        	t_binCount.push(0);
        }
        for(var i = 0; i < t_data.length; i++){
        	var tt_ind = parseInt((t_data[i][t_key] - t_min)/t_binRange);
            if(tt_ind >= t_bins){
            	tt_ind = t_bins - 1;
            }
            t_binCount[tt_ind] = t_binCount[tt_ind] + t_data[i].indexs.length;
        }
        var t_result = {
        	"attr": t_key,
        	"binNumber": t_bins,
        	"binCount": t_binCount,
        	"xRange": [t_min, t_max],
        	"yRange": [0, _.max(t_binCount)],
        };
        v_callback(t_result);
    };
}

function pixelmap(v_callback, v_parameters){
    return function(v_data){
        var t_key = v_parameters.key, t_size = v_parameters.size;
        var t_keySize = v_data.length;
        var t_data = t_sort(v_data, t_key), t_subData = _.map(t_data, "indexs");
        var t_min = t_data[0][t_key], t_max = t_data[t_data.length - 1][t_key];
        var t_subMax = _.max(_.max(t_subData, function(t){return _.max(t);}));
        var t_subMin = _.min(_.min(t_subData, function(t){return _.min(t);}));
        if(t_keySize < t_size[0]){
            t_size[0] = t_keySize;
        }
        var t_binR = (t_max - t_min) / t_size[0], t_subBinR = (t_subMax - t_subMin) / t_size[1];
        var t_aggCount = [];
        for(var i = 0; i < t_size[0]; i++){
            var tt_bin = [];
            for(var j = 0; j < t_size[1]; j++){
                tt_bin[j] = 0;
            }
            t_aggCount.push(tt_bin);
        }
        for(var i = 0; i < t_data.length; i++){
            var tt_i = parseInt((t_data[i][t_key] - t_min) / t_binR);
            if(tt_i >= t_size[0]){
                tt_i = t_size[0] - 1;
            }
            var tt_sub = t_subData[i];
            for(var j = 0; j < tt_sub.length; j++){
                var tt_j = parseInt((tt_sub[j] - t_subMin) / t_subBinR);
                if(tt_j >= t_size[1]){
                    tt_j = t_size[1] - 1;
                }
                t_aggCount[tt_i][tt_j]++
            }
        }
        t_aggCount = numeric.transpose(t_aggCount);
        var t_result = {
            "attr": v_parameters.attr,
            "subattr": v_parameters.subattr,
            "size": [t_size[1], t_size[0]],
            "aggCount": t_aggCount,
            "range": [t_min, t_max],
            "subRange": [t_subMin, t_subMax],
        };
        v_callback(t_result);
    };
}

function queryBC(v_query, v_aggr, v_allCondition, v_callback){
    var v_sheet = v_allCondition.table, v_conditions = v_allCondition.condition,
    v_dimensions = v_conditions.dimensions, v_parameters = v_allCondition.extra;
    var t0_length = 0, t_ratio = v_conditions.ratio;
    var t_attrs = v_conditions.return, t_dfs = [], t_barcharts = {}, t_ranges = {}, t_init = false, t_layout = null;
    var t_aggr = function(v_condition){
        var t_df = Q.defer();
        v_aggr(v_sheet, v_condition, function(v_data){
            t_df.resolve(v_data);
        });
        return t_df.promise;
    };
    if(!v_conditions.onlyProjection){
        for(var t_attr in t_attrs){
            if(t_attr == "id" || t_attr == "_id"){
                continue;
            }
            t_ranges[t_attr] = null;
            var t_data;
            var tv_df = t_aggr([
                {'$match': v_conditions.condition},
                {'$group':{_id: '$'+t_attr, attr: {'$addToSet': t_attr}, count:{'$sum': 1}}},
                ]).then(
                function(v_data){
                    if(v_data.length == 0){

                    }else{
                        var tk = v_data[0].attr;
                        t_data = v_data;
                        if(v_parameters[tk]){
                            var tt_data = t_sort(t_data, '_id');
                            var t_num = v_parameters[tk].count, t_range = v_parameters[tk].range;
                            if(!t_range){
                                t_range = [tt_data[0]['_id'], tt_data[tt_data.length - 1]['_id']];
                                t_ranges[tk] = t_range;
                                t_init = true;
                            }
                            var t_binR = (t_range[1] - t_range[0]) / t_num, t_bins = {};
                            _.each(tt_data, function(v_d){
                                var t_ind = Math.floor((v_d['_id'] - t_range[0]) / t_binR);
                                if(t_ind == t_num){
                                    t_ind --;
                                }
                                if(t_bins[t_ind]){
                                    t_bins[t_ind] += v_d['count'];
                                }else{
                                    t_bins[t_ind] = v_d['count'];
                                }
                            });
                            t_barcharts[tk] = t_bins;
                        }else{
                            var t_d = {};
                            _.each(t_data, function(v_d){
                                t_d[v_d._id] = v_d.count;
                            });
                            t_barcharts[tk] = t_d;
                        }
                    }
                }, function(v_err){
                    console.log("Error! " + v_err);
                });
                t_dfs.push(tv_df);
            }
        }else{
            var t_df = Q.defer();
            t_dfs.push(t_df.promise);
            t_df.resolve();
        }
        var t_dt = null, t_df0 = Q.defer();
        Q.all(t_dfs).done(
            function(){
                if(!t_init){
                    var tt_df = Q.defer();
                    var t_return = {'_id':0, 'timeDate': 1, 'freq': 1, 'baud': 1};
                    for(var i in v_dimensions){
                        t_return[v_dimensions[i]] = 1;
                    }
                    v_query(v_sheet, {condition: v_conditions.condition, return: t_return}, function(v_data){
                        tt_df.resolve(v_data);
                    });
                    Q.when(tt_df.promise, function(v_data){
                        t0_length = v_data.length;
                        t_df0.resolve();
                        if(t0_length == 0){
                            t_dt = [];
                            t_layout = null;
                        }else{
                            t_dt = _.map(v_data, function(vv_d){
                                var tt_d = {};
                                tt_d['timeDate'] = vv_d['timeDate'];
                                tt_d['freq'] = vv_d['freq'];
                                tt_d['baud'] = vv_d['baud'];
                                return tt_d;});
                            var t_array = [];
                            for(var i in v_dimensions){
                                var tt_name = v_dimensions[i];
                                t_array.push(_.map(v_data, tt_name));
                            }
                            t_array = numeric.transpose(t_array);
                            t_layout = MDS.getCoordinates(t_array);
                            t_layout = numeric.dot(t_array, t_layout);
                            var t_size = Math.round(Math.log10(t_layout.length));
                            t_layout = _.sample(t_layout, Math.round(t_layout.length * t_ratio[t_size]));
                        }
                    });
                }else{
                    t_df0.resolve();
                }
            });
        Q.when(t_df0.promise, function(){
                var t_length;
                if(!v_conditions.onlyProjection){
                    for(var i in t_barcharts){
                        if(!t_length){
                            var t_arr = t_barcharts[i];
                            t_length = 0;
                            for(var j in t_arr){
                                t_length += t_arr[j];
                            }
                            break;
                        }
                    }
                }else{ t_length = t0_length; };
                var t_result = {
                    data: t_dt,
                    barcharts: t_barcharts,
                    count: t_length,
                    range: t_ranges,
                    projection: t_layout,
                };
                v_callback(t_result);
            });
    }

    function queryBC_Old(v_callback, v_parameters){
        return function(v_data){
            var t_keys = _.keys(v_data[0]), t_barcharts = {}, t_ranges = {}, t_init = false;
            logger.log("Data returned: " + v_data.length);
            for(var i in t_keys){
                var tk = t_keys[i];
                if(tk == "id"){
                    continue;
                }
                t_ranges[tk] = null;
                if(v_parameters[tk]){
                    var t_num = v_parameters[tk].count, t_range = v_parameters[tk].range;
                    if(!t_range){
                        t_range = [_.min(v_data, tk)[tk], _.max(v_data, tk)[tk]];
                        t_ranges[tk] = t_range;
                        t_init = true;
                    }
                    var t_binR = (t_range[1] - t_range[0]) / t_num, t_bins = _.countBy(v_data, function(v_d){
                        var t_ind = Math.floor((v_d[tk] - t_range[0]) / t_binR);
                        if(t_ind == t_num){
                            t_ind --;
                        }
                        return t_ind;
                    });
                    t_barcharts[tk] = t_bins;
                }else{
                    t_barcharts[tk] = _.countBy(v_data, tk);
                }
            }
            var t_ids = _.map(v_data, "id");
            var t_result = {
                ids: t_init?null:t_ids,
                barcharts: t_barcharts,
                count: v_data.length,
                range: t_ranges,
            };
            v_callback(t_result);
        };
    }

    module.exports = {
        initialize: initialize,
        barchart: barchart,
        pixelmap: pixelmap,
        queryBC: queryBC,
    };