(function () {
    'use strict';
	var dot=numeric.dot, trans=numeric.transpose, sub=numeric.sub, div=numeric.div, clone=numeric.clone, getBlock=numeric.getBlock,
	add=numeric.add, mul=numeric.mul, svd=numeric.svd, norm2=numeric.norm2, identity=numeric.identity, dim=numeric.dim,
	getDiag=numeric.getDiag, inv=numeric.inv, det = numeric.det, norm2Squared = numeric.norm2Squared, norm1 = numeric.norm1;

	window['Basic'] = {

            KNNG: function (v_data, v_k) {
                var self = this, t_dist = MDS.getSquareDistances(v_data),
                t_KNN = function (vv_d, vv_k){
                	var tt_data = [], tt_indeces = [], tt_sort = function(a,b){return a.data - b.data;}, t_i = 0, tt_count = 0;
                	while(tt_count < vv_k && t_i < vv_d.length){
                		if(vv_d[t_i] != 0){
                            tt_data.push({data: vv_d[t_i], index: t_i});
                            tt_count ++;
                		}
                        t_i ++;
                	}
                	tt_data.sort(tt_sort);
                	var tt_last = tt_data[vv_k - 1].data;
                	for(var i = vv_k; i < vv_d.length; i++){
                		if(vv_d[i] == 0 || vv_d[i] >= tt_last){
                			continue;
                		}else{
                			tt_data.push({data: vv_d[i], index: i});
                			tt_data.sort(tt_sort);
                			tt_data.splice(vv_k);
                			tt_last = tt_data[vv_k - 1].data;
                		}
                	}
                	for(var i in tt_data){
                		tt_indeces.push(tt_data[i].index);
                	}
                	return tt_indeces;
                }, t_KNNG = [];
                for(var i in t_dist){
                	var t_d = t_dist[i], tt_KNN = t_KNN(t_d, v_k);
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
                t_dist = t_dist / t_n * 100
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
                let t_ext = {min: Infinity, max: -Infinity}
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

            getDistance: function(v_a, v_b){
                return norm2(sub(v_a, v_b));
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

            timerObj: function(v_time, v_func){
                return {
                    start: new Date(),
                    past: 0,
                    duration: v_time,
                    func: v_func,
                    finished: false,
                };
            },

            delay: function(v_name, v_time, v_func){
                if(this.timer[v_name] == null){
                    this.timer[v_name] = this.timerObj(v_time, v_func);
                }else{
                    if(this.timer[v_name].finished){
                        delete this.timer.v_name;
                    }
                    let t_obj = this.timer[v_name];
                    t_obj.past = new Date() - t_obj.start;
                    if(t_obj.past >= t_obj.duration){
                        v_func();
                        t_obj.finished = true;
                        delete this.timer.v_name;
                    }else{
                        t_obj.start = new Date();
                        t_obj.func = v_func;
                    }
                }
            },
	};
})();