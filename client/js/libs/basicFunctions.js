(function () {
    'use strict';
	var dot=numeric.dot, trans=numeric.transpose, sub=numeric.sub, div=numeric.div, clone=numeric.clone, getBlock=numeric.getBlock,
	add=numeric.add, mul=numeric.mul, svd=numeric.svd, norm2=numeric.norm2, identity=numeric.identity, dim=numeric.dim,
	getDiag=numeric.getDiag, inv=numeric.inv, det = numeric.det, norm2Squared = numeric.norm2Squared, norm1 = numeric.norm1;
    $.whenWithProgress = function(arrayOfPromises) {
       var cntr = 0;
       for (var i = 0; i < arrayOfPromises.length; i++) {
           arrayOfPromises[i].done();
       }
       return jQuery.when.apply(jQuery, arrayOfPromises);
    };

	window.Basic = {

            KNNG: function (v_data, v_k) {
                let t_dist = MDS.getSquareDistances(v_data),
                    t_KNN = (vv_d, vv_k, vv_i) => {
                    	// var tt_data = [], tt_indeces = [], tt_sort = function(a,b){return a.data - b.data;}, t_i = 0, tt_count = 0;
                    	// while(tt_count < vv_k && t_i < vv_d.length){
                    	// 	if(vv_d[t_i] != 0){
                     //            tt_data.push({data: vv_d[t_i], index: t_i});
                     //            tt_count ++;
                    	// 	}
                     //        t_i ++;
                    	// }
                    	// tt_data.sort(tt_sort);
                    	// var tt_last = tt_data[vv_k - 1].data;
                    	// for(var i = vv_k; i < vv_d.length; i++){
                    	// 	if(vv_d[i] == 0 || vv_d[i] >= tt_last){
                    	// 		continue;
                    	// 	}else{
                    	// 		tt_data.push({data: vv_d[i], index: i});
                    	// 		tt_data.sort(tt_sort);
                    	// 		tt_data.splice(vv_k);
                    	// 		tt_last = tt_data[vv_k - 1].data;
                    	// 	}
                    	// }
                    	// for(var i in tt_data){
                    	// 	tt_indeces.push(tt_data[i].index);
                    	// }
                    	// return tt_indeces;
                        let t_sortedDist = this.sortVector(vv_d), t_count = 0, t_return = new Array();
                        for(let i = 0; i < vv_d.length; i++){
                            let t_sInd = t_sortedDist.index[i];
                            if(t_sInd == vv_i || t_count >= vv_k){
                                continue;
                            }else{
                                t_return.push(t_sInd);
                                t_count++;
                            }
                        }
                        return t_return;
                    }, t_KNNG = [];
                for(var i in t_dist){
                	var t_d = t_dist[i], tt_KNN = t_KNN(t_d, v_k, i);
                	t_KNNG[i] = tt_KNN;
                }
                return t_KNNG;
            },

            KNNGByDistMat: function(v_distMat, v_k){
                let t_length = v_distMat.length,
                    t_distMat = this.initArray(t_length, t_length, function(i,j){
                        return {
                            index: j,
                            dist: v_distMat[i][j],
                        };
                    }),
                    t_neighbors = this.initArray(t_length, v_k);
                t_distMat.forEach((v_distRow, v_i) => {
                    v_distRow.sort((v_a, v_b) => {return v_a.dist - v_b.dist;});
                    let t_count = 0, t_ind = 0;
                    while(t_count < v_k && t_ind < v_distRow.length){
                        if(v_distRow[t_ind].dist < Number.EPSILON){
                            t_ind++;
                            continue;
                        }else{
                            t_neighbors[v_i][t_count] = v_distRow[t_ind].index;
                            t_count++;
                            t_ind++;
                        }
                    }
                });
                return t_neighbors;
            },

            KNNGDistance: function(v_ga, v_gb){
                var t_dist = 0, t_n = v_ga.length, t_k = v_ga[0].length;
                for(var i in v_ga){
                    var t_a = v_ga[i], t_b = v_gb[i], t_same = 0, t_all = 0;
                    for(var j in t_a){
                        if(t_b.indexOf(t_a[j]) >= 0){
                            t_same ++;
                            t_all ++;
                        }else{
                            t_all += 2;
                        }
                    }
                    var t_d = 1 - t_same / t_all;
                    t_dist += t_d;
                }
                t_dist = t_dist / t_n * 100;
                return t_dist;
            },

            scale: function(v_scales, v_data){
                return [v_scales.x(v_data[0]), v_scales.y(v_data[1])];
            },

            scaleArray: function(v_arr){
                let t_arr = trans(v_arr),
                    t_ranges = new Array(t_arr.length);
                for(let i = 0; i < t_arr.length; i++){
                    let t_range = [];
                    t_range[0] = Math.min(...t_arr[i]);
                    t_range[1] = Math.max(...t_arr[i]);
                    t_ranges[i] = t_range;
                }
                for(let i = 0; i < v_arr.length; i++){
                    for(let j = 0; j < v_arr[i].length; j++){
                        let t_v = v_arr[i][j];
                        v_arr[i][j] = (t_v - t_ranges[j][0]) / (t_ranges[j][1] - t_ranges[j][0]);
                    }
                }
                return v_arr;
            },

            extArray: function(v_arr){
                let t_ext = {min: Infinity, max: -Infinity};
                for(let i = 0; i < v_arr.length; i++){
                    for(let j = 0; j < v_arr[i].length; j++){
                        let t_data = v_arr[i][j];
                        if(t_data < t_ext.min){
                            t_ext.min = t_data;
                        }
                        if(t_data > t_ext.max){
                            t_ext.max = t_data;
                        }
                    }
                }
                return t_ext;
            },

            sortVector: function(v_vec, v_minToMax = true, v_returnInd = true){
                let t_length = v_vec.length, t_vec = new Array(t_length),
                    t_return_ind = new Array(t_length), t_return_val = new Array(t_length);
                for(let i = 0; i < t_length; i++){
                    t_vec.push({
                        index: i,
                        value: v_vec[i],
                    });
                }
                if(v_minToMax){
                    t_vec.sort((a,b)=>{return a.value - b.value;});
                }else{
                    t_vec.sort((a,b)=>{return b.value - a.value;});
                }
                for(let i = 0; i < t_length; i++){
                    t_return_ind[i] = t_vec[i].index;
                    t_return_val[i] = t_vec[i].value;
                }
                if(v_returnInd){
                    return {
                        index: t_return_ind,
                        value: t_return_val,
                    };
                }else{
                    return t_return_val;
                }
            },

            subArray: function(v_arr, v_row_indeces, v_col_indeces){
                let t_arr = this.initArray(v_row_indeces.length, v_col_indeces.length);
                for(let i = 0; i < v_row_indeces.length; i++){
                    let t_i = v_row_indeces[i];
                    for(let j = 0; j < v_col_indeces.length; j++){
                        let t_j = v_col_indeces[j];
                        t_arr[i][j] = v_arr[t_i][t_j];
                    }
                }
                return t_arr;
            },

            subVector: function(v_vec, v_indeces){
                let t_vec = new Array(v_indeces.length);
                for(let i = 0; i < v_indeces.length; i++){
                    t_vec[i] = v_vec[v_indeces[i]];
                }
                return t_vec;
            },

            trimArray: function(v_arr, v_prec){
                var t_arr = [];
                for(var i in v_arr){
                    var tt_arr = [];
                    for(var j in v_arr[i]){
                        tt_arr[j] = parseFloat(v_arr[i][j].toFixed(v_prec));
                    }
                    t_arr[i] = tt_arr;
                }
                return t_arr;
            },

            trimNumber: function(v_num, [v_min, v_max]){
                let t_new = v_num, t_nullmin = (v_min == null), t_nullmax = (v_max == null);
                if((t_nullmin && t_nullmax) || (!t_nullmin && !t_nullmax && v_min > v_max)){
                    return null;
                }
                if(!t_nullmin && t_new < v_min){
                    t_new = v_min;
                }
                if(!t_nullmax && t_new > v_max){
                    t_new = v_max;
                }
                return t_new;
            },

            sameArray: function(v_arr_1, v_arr_2){
                if(v_arr_1 == null || v_arr_2 == null || v_arr_1.length != v_arr_2.length){
                    return false;
                }
                let t_arr_1 = v_arr_1.slice(0).sort(),
                    t_arr_2 = v_arr_2.slice(0).sort(),
                    t_same = true, t_length = v_arr_1.length;
                for(let i = 0; i < t_length; i++){
                    if(v_arr_1[i] != v_arr_2.length){
                        t_same = false;
                        break;
                    }
                }
                return t_same;
            },

            printArray: function(v_arr){
                let t_outArr = new Array(v_arr.length);
                for(let i = 0; i < v_arr.length; i++){
                    let t_arr_i = v_arr[i];
                    t_outArr[i] = t_arr_i.length?t_arr_i.join(" "):t_arr_i;
                }
                console.log(t_outArr.join("\n"));
            },

            initArray: function(v_rows, v_colums, v_fillFunc){
                let t_array = [];
                    for(let i = 0; i < v_rows; i++){
                        let tt_array = null;
                        if(v_colums || v_colums == 0){
                            tt_array = [];
                            for(let j = 0; j < v_colums; j++){
                                if(v_fillFunc){
                                    tt_array[j] = v_fillFunc(i,j);
                                }else{
                                    tt_array[j] = 0;
                                }
                            }
                        }
                        t_array.push(tt_array);
                    }
                return t_array;
            },

            mapToArray: function(v_map, v_type = "values"){
                let t_iter;
                switch(v_type){
                    case "values":
                        t_iter = v_map.values();
                    break;
                    case "keys":
                        t_iter = v_map.keys();
                    break;
                    case "entries":
                        t_iter = v_map.entries();
                    break;
                }
                let t_return = [], t_value = t_iter.next();
                while(!t_value.done){
                    t_return.push(t_value.value);
                    t_value = t_iter.next();
                }
                return t_return;
            },

            arrToCube: function(v_arr, v_rows, v_cols, v_byRow = true){
                let t_cube = new Array(v_arr.length);
                if(v_byRow){
                    for(let i = 0; i < v_arr.length; i++){
                        let t_row = v_arr[i],
                            t_arr = this.initArray(v_rows, v_cols);
                        for(let j = 0; j < v_rows; j++){
                            let t_start = j * v_cols;
                            for(let k = 0; k < v_cols; k++){
                                t_arr[j][k] = t_row[t_start + k];
                            }
                        }
                        t_cube[i] = t_arr;
                    }
                }else{
                    for(let i = 0; i < v_arr.length; i++){
                        let t_row = v_arr[i],
                            t_arr = this.initArray(v_rows, v_cols);
                        for(let k = 0; k < v_cols; k++){
                            let t_start = k * v_rows;
                            for(let j = 0; j < v_rows; j++){
                                t_arr[j][k] = t_row[t_start + j];
                            }
                        }
                        t_cube[i] = t_arr;
                    }
                }
                return t_cube;
            },

            getAngle: function(v_start, v_end){
                let t_dx = v_end[0] - v_start[0],
                    t_dy = v_end[1] - v_start[1],
                    t_PI = Math.PI,
                    t_tolerance = Number.EPSILON * 100,
                    t_angle;
                if(Math.abs(t_dx) < t_tolerance){
                    if(Math.abs(t_dy) > t_tolerance){
                        t_angle = (t_dy > 0?1:(-1)) * t_PI * 0.5;
                    }
                }else{
                    t_angle = Math.atan(t_dy / t_dx);
                    if(t_dx < 0){
                        t_angle += t_PI;
                    }
                }
                return t_angle;
            },

            getDistanceMatrix: function(v_vectors){
                let t_length = v_vectors.length;
                if(t_length == 0){
                    return [];
                }
                let t_distMat = this.initArray(t_length, t_length);
                for(let i = 0; i < t_length - 1; i++){
                    let v_i = v_vectors[i];
                    for(let j = i+1; j < t_length; j++){
                        let v_j = v_vectors[j];
                        t_distMat[i][j] = t_distMat[j][i] = this.getDistance(v_i, v_j);
                    }
                }
                return t_distMat;
            },

            getDistance: function(v_a, v_b){
                return norm2(sub(v_a, v_b));
            },

            getMeanVector: function(v_arr, v_isColVec){
                let t_arr = v_isColVec?v_arr:trans(v_arr),
                    t_dim = numeric.dim(t_arr),
                    t_mean = new Array(t_dim[0]),
                    t_num = t_dim[1];
                for(let i = 0; i < t_arr.length; i++){
                    t_mean[i] = numeric.sum(t_arr[i]) / t_num;
                }
                return t_mean;
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

            extractNumber: function(v_string){
                return v_string.replace(/[a-z|(|)]/g,"").split(",");
            },

            timer: new Object(),

            timerObj: function(v_name, v_time, v_func){
                let t_this = this;
                return {
                    start: new Date(),
                    past: 0,
                    duration: v_time,
                    func: v_func,
                    finished: false,
                    timer: setTimeout(() => {
                        v_func();
                        t_this.timer[v_name] = null;
                    }, v_time),
                };
            },

            delay: function(v_name, v_time, v_func){
                let t_timeObj = this.timer[v_name];
                if(t_timeObj == null){
                    this.timer[v_name] = this.timerObj(v_name, v_time, v_func);
                }else{
                    if(t_timeObj.finished){
                        clearTimeout(t_timeObj.timer);
                        t_timeObj = null;
                    }
                    let t_obj = this.timer[v_name];
                    t_obj.past = new Date() - t_obj.start;
                    if(t_obj.past >= t_obj.duration){
                        v_func();
                        t_obj.finished = true;
                        clearTimeout(t_obj.timer);
                        this.timer[v_name] = null;
                    }else{
                        t_obj.start = new Date();
                        t_obj.func = v_func;
                    }
                }
            },

            clearDelay: function(v_name){
                let t_timeObj = this.timer[v_name];
                if(t_timeObj != null){
                    clearTimeout(t_timeObj.timer);
                    t_timeObj = null;
                }
            },

            combineMaps: function(v_map_1, v_map_2, v_combineValueFunc){
                let t_map = new Map(),
                    t_map_1 = this.mapToArray(v_map_1, "entries"),
                    t_map_2 = this.mapToArray(v_map_2, "entries"),
                    t_matchArr_1 = new Array(t_map_1.length).fill(false),
                    t_matchArr_2 = new Array(t_map_2.length).fill(false);
                for(let i = 0; i < t_map_1.length; i++){
                    let t_key_1 = t_map_1[i][0], t_value_1 = t_map_1[i][1];
                    for(let j = 0; j < t_map_2.length; j++){
                        let t_key_2 = t_map_2[j][0], t_value_2 = t_map_2[j][1], t_newValue;
                        if(t_key_1 == t_key_2){
                            t_newValue = v_combineValueFunc(t_value_1, t_value_2);
                            if(!t_map.has(t_key_1)){
                                t_map.set(t_key_1, t_newValue);
                            }else{
                                let t_originValue = t_map.get(t_key_1);
                                t_newValue = v_combineValueFunc(t_originValue, t_newValue);
                                t_map.set(t_key_1, t_newValue);
                            }
                            t_matchArr_1[i] = true;
                            t_matchArr_2[j] = true;
                        }
                    }
                }
                for(let i = 0; i < t_matchArr_1.length; i++){
                    if(!t_matchArr_1[i]){
                        let t_key = t_map_1[i][0], t_value = t_map_1[i][1];
                        if(!t_map.has(t_key)){
                            t_map.set(t_key, t_value);
                        }else{
                            let t_originValue = t_map.get(t_key);
                            t_value = v_combineValueFunc(t_originValue, t_value);
                            t_map.set(t_key, t_value);
                        }
                    }
                }
                for(let i = 0; i < t_matchArr_2.length; i++){
                    if(!t_matchArr_2[i]){
                        let t_key = t_map_2[i][0], t_value = t_map_2[i][1];
                        if(!t_map.has(t_key)){
                            t_map.set(t_key, t_value);
                        }else{
                            let t_originValue = t_map.get(t_key);
                            t_value = v_combineValueFunc(t_originValue, t_value);
                            t_map.set(t_key, t_value);
                        }
                    }
                }
                return t_map;
            },

            traverseTree: function(v_tree, v_subTreeFunc, v_leavesFunc){
                let t_result = this.traverseTreeLevel(v_tree, v_subTreeFunc, v_leavesFunc, new Array()),
                    t_return_tree = t_result.subtree;
                t_return_tree.supernode = v_subTreeFunc(t_result.subtree, new Array());
                return t_return_tree;
            },

            traverseTreeLevel: function(v_tree, v_subTreeFunc, v_leavesFunc, t_path){
                if(v_tree.length == null){
                    return null;
                }
                let t_newTree = new Array(),
                    t_supernodes = new Array(),
                    t_subLeaves = new Array(),
                    t_leafIndeces = new Array(),
                    t_onlyLeaves = true;
                for(let i = 0 ;i < v_tree.length; i++){
                    let t_subTree = v_tree[i];
                    if(t_subTree.length!= null){
                        let t_newPath = [...t_path, i],
                            t_subResult = this.traverseTreeLevel(t_subTree, v_subTreeFunc, v_leavesFunc, t_newPath),
                            t_newSubTree = t_subResult.subtree;
                        t_newSubTree.supernode = v_subTreeFunc(t_newSubTree, t_newPath);
                        // the new node contain one or more supernodes
                        t_supernodes.push(t_newSubTree.supernode);
                        // handle a subtree node with only 1 level
                        // input: a group of supernodes, and its index path in the whole tree
                        // output: one super node
                        t_newTree.push(t_newSubTree);
                        t_onlyLeaves = false;
                    }else{
                        t_subLeaves.push(t_subTree);
                        t_leafIndeces.push(i);
                    }
                }
                let t_leafResult = v_leavesFunc(t_subLeaves, t_onlyLeaves, [...t_path, t_leafIndeces]);
                // handle a bunch of leaf nodes, turn them into one supernode
                // input: a group of original leaf nodes, and wheter they have subtree brothers
                // output: {
                //     supernode: one super node,
                //     leafnode: an array of leaf nodes, can store user-defined nodes
                // }
                t_subLeaves = t_leafResult.leafnode;
                t_subLeaves.supernode = t_leafResult.supernode;
                t_supernodes.push(t_leafResult.supernode);
                t_newTree.push(t_subLeaves);
                return {
                    subtree: t_newTree,
                    supernodes: t_supernodes,
                };
            },

            download: function(v_content, v_name, v_format){
                switch(v_format){
                    case 'csv':
                        let t_link = document.createElement("a"),
                            t_blob = new Blob(["\ufeff" + v_content], {type: 'text/csv,charset=UTF-8'}); //解决大文件下载失败
                        t_link.setAttribute("href", URL.createObjectURL(t_blob));
                        t_link.setAttribute("download", v_name + ".csv");
                        document.body.appendChild(t_link);
                        t_link.click();
                        document.body.removeChild(t_link);
                    break;
                    default:
                    break;
                }
            },

            getHDData: function(v_objs, v_index){
                let t_titles = new Array(),
                    t_data = new Array(),
                    t_indices = new Map();
                for(let i in v_objs[0]){
                    if(v_index != null && i != v_index){
                        t_titles.push(i);
                    }
                }
                for(let i = 0; i < v_objs.length; i++){
                    let t_obj = v_objs[i],
                        t_dimension = new Array();
                    for(let j = 0; j < t_titles.length; j++){
                        t_dimension.push(parseFloat(t_obj[t_titles[j]]));
                    }
                    t_indices.set(i, t_obj[v_index]);
                    t_data.push(t_dimension);
                }
                return {
                    titles: t_titles,
                    data: t_data,
                    IDs: t_indices,
                };
            },
	};
})();
