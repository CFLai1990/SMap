(function () {
    'use strict';
    window['Tiling'] = {

    	scoreDirection: "min",
    	scoreDataWeight: [0.95, 0.05],

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

        normalize: function(v_arr){
        	let t_max = -Infinity,
        		t_min = Infinity,
        		t_arr = new Array(v_arr.length);
        	for(let i = 0; i < v_arr.length; i++){
        		for(let j = 0; j < v_arr[i].length; j++){
        			let t_ele = v_arr[i][j];
        			if(t_max < t_ele){
        				t_max = t_ele;
        			}
        			if(t_min > t_ele){
        				t_min = t_ele;
        			}
        		}
        	}
        	if(t_min != Infinity){
        		if((t_max - t_min) < Number.EPSILON){
		        	for(let i = 0; i < v_arr.length; i++){
		        		let tt_arr = new Array(v_arr[i].length);
		        		tt_arr.fill(0);
		        		t_arr[i] = tt_arr;
		    		}
        		}else{
        			let t_div = t_max - t_min;
		        	for(let i = 0; i < v_arr.length; i++){
		        		let tt_arr = new Array(v_arr[i].length);
		        		for(let j = 0; j < v_arr[i].length; j++){
		        			tt_arr[j] = (v_arr[i][j] - t_min) / t_div;
		    			}
		        		t_arr[i] = tt_arr;
		    		}
        		}
        	}
        	return t_arr;
        },

    	getScore: function(v_pointDist, v_gridDist, v_codeDist = 0){
    		let t_w = this.scoreDataWeight,
    			t_score = (1 / v_pointDist) * (t_w[0] * v_gridDist + t_w[1] * v_codeDist);
    		if(t_score < Number.EPSILON){
    			t_score = Number.EPSILON;
    		}
    		return t_score;
    	},

        getPoints: function(v_nghList, v_distMat){
            let distObj = function(v_ind, v_dist){return {index: v_ind, dist: v_dist}},
            pointObj = function(v_id){
            	let t_point = {
	                    id: v_id,
	                    cords: null,
	                    finished: false,
	                    neighbors: new Map(),
	                    FinishedNeighbors: new Map(),
	                    FinishedNearest: Infinity,
	                };
                return t_point;
            }, t_points = new Array(v_distMat.length),
            t_distMat = this.normalize(v_distMat);
            t_points.distMat = t_distMat;
            t_points.waitingList = new Set();
            for(let i = 0; i < t_points.length; i++){
            	t_points[i] = pointObj(i);
            	t_points.waitingList.add(i);
            }
            for(let t_ind = 0; t_ind < t_points.length; t_ind++){
                let t_vghs = v_nghList[t_ind],
                    t_dist = v_distMat[t_ind],
                    t_point = t_points[t_ind];                
                t_vghs.forEach(vv_ind => {
                    let tt_dist = t_dist[vv_ind],
                        tt_point = t_points[vv_ind];
                    if(!t_point.neighbors.has(vv_ind)){
                        t_point.neighbors.set(vv_ind, distObj(vv_ind, tt_dist));
                    }
                    if(!tt_point.neighbors.has(t_ind)){
                        tt_point.neighbors.set(t_ind, distObj(t_ind, tt_dist));
                    }
                });
            }
            t_points.getCenter = function(){
            	let t_sum = new Array(t_distMat.length);
            	t_sum.fill(0);
            	for(let i = 0; i < t_distMat.length; i++){
            		let tt_sum = 0, tt_length = t_distMat[i].length;
            		for(let j = 0; j < tt_length; j++){
            			tt_sum += t_distMat[i][j];
            		}
            		if(tt_length > 0){
	            		tt_sum /= tt_length;
            		}
            		t_sum[i] += tt_sum;
            	}
            	return t_sum.indexOf(Math.min(...t_sum));
            };
            t_points.getNeighborDist = function(v_a, v_b){
                let t_point = this[v_a].neighbors, t_found = false, t_dist = null;
                t_point.forEach(v_neighbor => {
                    if(t_found){
                        return;
                    }else{
                        if(v_neighbor.index == v_b){
                            t_found = true;
                            t_dist = v_neighbor.dist;
                        }
                    }
                });
                if(!t_found){
                    let tt_a = t_distMat[v_a];
                    if(tt_a && tt_a[v_b]){
                        t_dist = tt_a[v_b];
                    }
                }
                return t_dist;
            };
                let t_map2Arr = this.mapToArray;
            t_points.update = function(v_pID, v_cords, v_codes){
                let t_point = this[v_pID], t_neighbors = t_point.neighbors;
                this.waitingList.delete(v_pID);
                t_point.finished = true;
                t_point.cords = v_cords;
                t_point.FinishedNeighbors.clear();
                t_point.FinishedNearest = 0;
                t_neighbors.forEach(v_neighbor => {
                    let tt_ind = v_neighbor.index,
                        tt_point = this[tt_ind];
                    if(!tt_point.finished){
                    	let tt_dist = v_neighbor.dist;
                        tt_point.FinishedNeighbors.set(v_pID, tt_dist);
                        if(tt_dist < tt_point.FinishedNearest){
                            tt_point.FinishedNearest = tt_dist;
                        }
                    }
                });
            };
            t_points.getNext = function(v_boundary){
	            let t_minInd = null, t_minDist = Infinity;
                if(!v_boundary){
	                this.forEach(v_point => {
	                    if(!v_point.finished && v_point.FinishedNearest < t_minDist){
	                        t_minDist = v_point.FinishedNearest;
	                        t_minInd = v_point.id;
	                    }
	                });
	            }else{//Points missed
	            	let t_minInds = [];
                	this.waitingList.forEach(v_wPoint => {
                		let tt_minInd = null,
                			tt_minDist = Infinity;
                		v_boundary.forEach(v_fPoint =>{
                			let tt_dist = this.getNeighborDist(v_wPoint, v_fPoint);
                			if(tt_dist < tt_minDist){
                				tt_minDist = tt_dist;
                				tt_minInd = v_fPoint;
                			}
                		});
                		if(tt_minDist < t_minDist){
                			t_minDist = tt_minDist
                			t_minInds = [[v_wPoint, tt_minInd]];
                		}else{
                			if(tt_minDist == t_minDist){
                				t_minInds.push([v_wPoint,tt_minInd]);
                			}
                		}
                	});
                	if(t_minInds.length > 0){
                		let [tt_ind, tt_ngh] = t_minInds[0];//random choose
	                	this[tt_ind].FinishedNeighbors.set(tt_ngh, t_minDist);
	                	this[tt_ind].FinishedNearest = t_minDist;
	                	t_minInd = tt_ind;
	                }
                }
                return t_minInd;
            };
            return t_points;
        },

        getGrids: function(v_pointNum, v_gridType, v_factor){
        	let getGrid = function(v_cords, v_pos){
        		return {
        			id: v_cords.join("_"),
        			cords: v_cords,
                    pos: v_pos,
					available: true,
                    pIndex: null,
                    score: 0,
                    scoreCount: 0,
                   	neighbors: new Map(),
                   	availableNeighbors: new Map(),
                };
        	}, getGridNum = function(){
	            let t_num = Math.round(v_pointNum * v_factor),
	                t_gridNum = null;
	                switch(v_gridType){
	                	case "hexagon":
			                if(t_num == 7){
			                    t_num = 8;
			                }
			                if(t_num < 7){
			                    t_gridNum = 2;
			                }else{
			                    t_gridNum = Math.ceil((3 + Math.sqrt(9 - 12 * (1 - t_num))) / 6)
			                }
	                	break;
	                }
	                return t_gridNum;
	        }, getRadius = function(v_gridNum){
	        	let t_radius = null;
	        	switch(v_gridType){
	        		case "hexagon":
	        			t_radius = 0.5 / (v_gridNum * 2 - 1);
	        		break;
	        	}
	        	return t_radius;
	        }, getNeighbors = function(v_grid, v_sizeMat){
	        	let getDivs;
	        	switch(v_gridType){
	        		case "hexagon":
		        		getDivs = function([vv_y, vv_x]){
		        			let tt_gridNum = Math.round((v_sizeMat.length + 1) * 0.5),
		        				tt_sign = Math.sign(vv_y - (tt_gridNum - 1));
		        				return [
		        					[0, 1],
		        					[-1, tt_sign>0?1:0],
		        					[-1, tt_sign>0?0:-1],
		        					[0, -1],
		        					[1, tt_sign<0?0:-1],
		        					[1, tt_sign<0?1:0]
		        				];
			            }
	        		break;
	        	}
	        	let t_cords = v_grid.cords, t_divs = getDivs(t_cords);
	        	for(let i = 0; i < t_divs.length; i++){
	        		let tt_y = t_divs[i][0] + t_cords[0], 
	        			tt_x = t_divs[i][1] + t_cords[1];
	        		if(tt_y < 0 || tt_x < 0 || tt_y >= v_sizeMat.length || tt_x >= v_sizeMat[tt_y]){
	        			continue;
	        		}else{
	        			let tt_cords = [tt_y, tt_x];
	        			v_grid.neighbors.set(tt_cords.join("_"), tt_cords);
	        			v_grid.availableNeighbors.set(tt_cords.join("_"), tt_cords);
	        		}
	        	}
	        }, getGridNeighhbors = function(v_grids){
	        	let t_size = [];
	        	for(let i = 0; i < v_grids.length; i++){
	        		t_size[i] = v_grids[i].length;
	        	}
	        	v_grids.forEach((v_row, v_i) => {
	        		for(let j = 0; j < v_row.length; j++){
	        			getNeighbors(v_row[j], t_size);
	        		}
	        	});
	        }, getHexagons = function(v_gridNum){
	        	let t_grids = new Array(v_gridNum * 2 - 1), t_r = getRadius(v_gridNum);
	        	for(let t_y = 0; t_y < t_grids.length; t_y++){
	                let tt_cols = t_y + v_gridNum;
	                if(t_y > v_gridNum - 1){
	                    tt_cols = 3 * v_gridNum - 2 - t_y;
	                }
	                let tt_grids = [], tt_dxpos = (Math.abs(v_gridNum - 1 - t_y) + 1) * t_r,
	                    tt_ypos = 0.5 - Math.sqrt(3) * t_r * (v_gridNum - 1 - t_y);
	                for(let t_x = 0; t_x < tt_cols; t_x++){
	                    tt_grids[t_x] = getGrid([t_y, t_x], [tt_dxpos + t_x * 2 * t_r, tt_ypos]);
	                };
	                t_grids[t_y] = tt_grids;
	        	};
	        	getGridNeighhbors(t_grids);
	        	return t_grids;
	        };
            let t_grids = [], t_map2Arr = this.mapToArray, t_direction = this.scoreDirection,
            	t_gridNum = getGridNum();
            switch(v_gridType){
            	case "hexagon":
            		t_grids = getHexagons(t_gridNum);
            	break;
            }
            t_grids.gridNum = t_gridNum;
            t_grids.radius = (2 * t_gridNum - 1);
            t_grids.waitingList = new Map();
            t_grids.getCenter = function(){
            	let tt_cords = [];
            	switch(v_gridType){
            		case "hexagon":
            			tt_cords = [this.gridNum - 1, this.gridNum - 1];
            		break;
            	}
            	return tt_cords;
            };
            t_grids.getCenterPID = function(){
                let t_cords = this.getCenter();
                return this[t_cords[0]][t_cords[1]].pIndex;
            };
            t_grids.update = function(v_pID, [v_y, v_x]){
            	let t_grid = this[v_y][v_x],
            		t_neighbors = t_grid.neighbors,
            		t_avlNgh = t_grid.availableNeighbors;
            	t_grid.pIndex = v_pID;
            	t_grid.available = false;
            	t_neighbors.forEach(v_nghCord => {
            		let tt_ngh = this[v_nghCord[0]][v_nghCord[1]];
            		tt_ngh.availableNeighbors.delete(v_y + "_" + v_x);
            		if(tt_ngh.pIndex != null && this.waitingList.has(tt_ngh.pIndex)){
	            		if(tt_ngh.availableNeighbors.size > 0){
	            			this.waitingList.set(tt_ngh.pIndex, t_map2Arr(tt_ngh.availableNeighbors, "values"));
	            		}else{
	            			this.waitingList.delete(tt_ngh.pIndex);
	            		}
            		}
            	});
            	if(t_avlNgh.size > 0){
            		this.waitingList.set(t_grid.pIndex, t_map2Arr(t_avlNgh, "values"));
            	}else{
            		this.waitingList.delete(t_grid.pIndex);
            	}
            };
            t_grids.getBoundary = () => {
            	return this.mapToArray(t_grids.waitingList, "keys");
            };
            t_grids.getDistance = function(v_aCords, v_bCords){
            	let t_dist = 0,
            		t_aPos = this[v_aCords[0]][v_aCords[1]].pos,
            		t_bPos = this[v_bCords[0]][v_bCords[1]].pos;
            	switch(v_gridType){
            		case "hexagon":
            			let t_divy = t_aPos[0] - t_bPos[0],
            				t_divx = t_aPos[1] - t_bPos[1];
	            			t_dist = Math.sqrt(Math.pow(t_divy,2) + Math.pow(t_divx,2));
	            					// * Math.sqrt(Math.pow(t_bPos[0]-0.5, 2) + Math.pow(t_bPos[1]-0.5, 2));
            		break;
            	}
            	return t_dist;
            };
            t_grids.getScore = function([v_y, v_x], v_score){
            	try{
                	if(this[v_y][v_x].pIndex){
                		throw "Overlapped!";
                	}
            	}catch(e){
            		console.log("ERROR! ", [v_y, v_x], this[v_y][v_x], this.waitingList);
            		console.log(e);
            	}
                this[v_y][v_x].score += v_score;
                this[v_y][v_x].scoreCount ++;
            };
            t_grids.getExtreamScore = function(v_gridList){
            	let t_inds = [], t_extremum, t_compare;
            	if(t_direction == "min"){
            		t_extremum = Infinity;
            		t_compare = function(a,b){return a < b;};
            	}
            	if(t_direction == "max"){
            		t_extremum = -Infinity;
            		t_compare = function(a,b){return a > b;};
            	}
            	if(t_extremum != null){
	            	v_gridList.forEach(v_cords => {
	            		let tt_score = this[v_cords[0]][v_cords[1]].score;
	            		if(t_compare(tt_score, t_extremum)){
	            			t_extremum = tt_score;
	            			t_inds = [v_cords];
	            		}else{
		            		if(tt_score == t_extremum){
		            			t_inds.push(v_cords);
		            		}
	            		}
	            	});
            	}
            	return t_inds;
            };
            t_grids.clearScores = function(){
                for(let t_i = 0; t_i < this.length; t_i++){
                    for(let t_j = 0; t_j < this[t_i].length; t_j++){
                        this[t_i][t_j].score = 0;
                        this[t_i][t_j].scoreCount = 0;
                    }
                }
            };
            return t_grids;
        },

        getCodes: function(v_codeBook){
        	let t_codes = null;
        	if(v_codeBook != null){
        		let t_codeLength = v_codeBook[0].length,
        			t_div = Math.PI * 2 / v_codeBook[0].length,
        			t_angle = new Array(t_codeLength),
        			t_map2Arr = this.mapToArray;
    			for(let i = 0; i < t_codeLength; i++){
    				let tt_code = new Array(t_codeLength),
	    				tt_aggrCodes = new Array(t_codeLength),
	    				tt_aggrCode = new Array(t_codeLength),
    					tt_angle = t_div * i;
    				tt_code.fill(0);
    				tt_aggrCodes.fill(0);
    				tt_aggrCode.fill(0);
    				// tt_code[i] = 1;
    				t_angle[i] = {
    					id: i,
    					angle: t_div * i,
    					vector: [Math.cos(tt_angle), Math.sin(tt_angle)],
    					code: tt_code,
    					aggrCode: tt_aggrCode,
    					aggrCodes: tt_aggrCodes,
    					aggrCount: 0,
    				}
    			}
        		t_codes = {
        			dictionary: v_codeBook,
        			angleCodes: t_angle,
        		};
                t_codes.getCode = function(v_pID){
                    if(this.dictionary[v_pID]){
                        return this.dictionary[v_pID].join("");
                    }else{
                        return "";
                    }
                };
        		t_codes.getCodeDist = function(v_aPos, v_bPos){
        			let t_aLength = Math.sqrt(Math.pow(v_aPos[0],2) + Math.pow(v_aPos[1],2)),
        				t_bLength = Math.sqrt(Math.pow(v_bPos[0],2) + Math.pow(v_bPos[1],2)),
        				t_dist = 0; 
        			if(t_aLength > Number.EPSILON && t_bLength > Number.EPSILON){
        				t_dist = (1 - (v_aPos[0] * v_bPos[0] + v_aPos[1] * v_bPos[1]) / (t_aLength * t_bLength)) / 2;
        			}
        			return t_dist;
        		};
        		t_codes.getDistance = function(v_aCode, v_bCode){
        			let t_dist = 0, t_same = 0, t_diff = 0;
        			for(let i = 0; i < t_codeLength; i++){
        				if(v_aCode[i] == v_bCode[i]){
        					t_same++;
        				}else{
        					t_diff++;
        				}
        			}
        			t_dist = t_diff / (t_same + t_diff);
        			return t_dist;
        		};
        		t_codes.getWeightDist = function(v_aCode, v_bCode){
        			let t_dist = 0, t_same = 0, t_diff = 0;
        			for(let i = 0; i < t_codeLength; i++){
        				t_dist += Math.abs(v_aCode[i] - v_bCode[i]);
        			}
        			return t_dist;
        		};
        		t_codes.getGridDist = function([v_px, v_py], v_angleID){
        			let t_dist;
        			if(v_py == 0 && v_px == 0){
        				t_dist = 0;
        			}else{
        				let t_length = Math.sqrt(v_px * v_px + v_py * v_py),
        					t_angle = this.angleCodes[v_angleID],
        					t_vector = [v_px / t_length, v_py / t_length],
        					t_score = t_angle.vector[0] * t_vector[0] + t_angle.vector[1] * t_vector[1];
        				t_dist = 1 - t_score;
        			}
        			return t_dist;
        		};
        		t_codes.findNearestAngle = function(v_pos, v_code){
        			let	t_minDist = Infinity,
        				t_minInd = [];
        			this.angleCodes.forEach(v_angle => {
        				let t_dist = this.getGridDist(v_pos, v_angle.id);
        				if(t_dist < t_minDist){
        					t_minInd = [v_angle.id];
        					t_minDist = t_dist;
        				}else{
        					if(t_dist == t_minDist){
        						t_minInd.push(v_angle.id);
        					}
        				}
        			});
        			if(t_minInd.length == 1){
        				t_minInd = t_minInd[0];
        			}else{
        				let tt_minDist = Infinity, tt_minInd = [];
        				t_minInd.forEach(v_angleID => {
        					let t_angle = this.angleCodes[v_angleID],
        						t_dist = this.getDistance(t_angle.code, v_code);
	        				if(t_dist < tt_minDist){
	        					tt_minInd = [v_angleID];
	        					tt_minDist = t_dist;
	        				}else{
	        					if(t_dist == tt_minDist){
	        						tt_minInd.push(v_angleID);
	        					}
	        				}
        				});
    					t_minInd = tt_minInd[0];//random choose
        			}
        			return t_minInd;
        		};
        		t_codes.update = function(v_pID, v_pos){
        			let t_pCode = this.dictionary[v_pID],
        				t_angleID = this.findNearestAngle(v_pos, t_pCode),
        				t_angle = this.angleCodes[t_angleID];
        			t_angle.aggrCount++;
        			for(let i = 0; i < t_codeLength; i++){
        				t_angle.aggrCodes[i] += t_pCode[i];
        				t_angle.aggrCode[i] = t_angle.aggrCodes[i] / t_angle.aggrCount;
        			}
        		};
        		t_codes.findBestAngle = function(v_code){
        			let t_angleID = null, t_minDist = Infinity, t_minInd = [];
        			this.angleCodes.forEach(v_angle => {
        				let t_dist = this.getDistance(v_angle.code, v_code);
        				if(t_dist < t_minDist){
        					t_minInd = [v_angle.id];
        					t_minDist = t_dist;
        				}else{
        					if(t_dist == t_minDist){
        						t_minInd.push(v_angle.id);
        					}
        				}
        			});
        			if(t_minInd.length == 1){
        				t_minInd = t_minInd[0];
        			}else{
        				let tt_minDist = Infinity, tt_minInd = [];
        				t_minInd.forEach(v_angleID => {
        					let t_angle = this.angleCodes[v_angleID],
        						t_dist = this.getWeightDist(t_angle.aggrCode, v_code);
	        				if(t_dist < tt_minDist){
	        					tt_minInd = [v_angleID];
	        					tt_minDist = t_dist;
	        				}else{
	        					if(t_dist == tt_minDist){
	        						tt_minInd.push(v_angleID);
	        					}
	        				}
        				});
    					t_minInd = tt_minInd[0];//random choose
        			}
        			return t_minInd;
        		};
        		t_codes.choose = function(v_pID, v_gridList){
        			let t_pCode = this.dictionary[v_pID],
	        			t_angleID = this.findBestAngle(t_pCode),
	        			t_gridPos = t_map2Arr(v_gridList, "entries"),
        				t_minInd = [],
        				t_minDist = Infinity;
        			t_gridPos.forEach(v_gridEntry => {
        				let t_ind = v_gridEntry[0].split("_"),
        					t_pos = v_gridEntry[1],
        					t_dist = this.getGridDist(t_pos, t_angleID);
        				if(t_dist < t_minDist){
        					t_minDist = t_dist;
        					t_minInd = [t_ind];
        				}else{
        					if(t_dist == t_minDist){
        						t_minInd.push(t_ind);
        					}
        				}
        			});
        			return t_minInd[0];//random choose
        		};
        	}
        	return t_codes;
        },

        getGridMap: function(v_points, v_grids, v_codes){
            let assign = function(v_pID, [v_y, v_x]){
            	v_grids.update(v_pID, [v_y, v_x]);
            	v_points.update(v_pID, [v_y, v_x], v_codes);
            	if(v_codes){
            		v_codes.update(v_pID, v_grids[v_y][v_x].pos);
            	}
            	let t_next = v_points.getNext();
            	if(!t_next){
            		let t_boundary = v_grids.getBoundary();
            		if(t_boundary.length > 0){
	            		t_next = v_points.getNext(t_boundary);
            		}
            	}
            	return t_next;
            }, getUnionList = function(v_gridList){
            	let t_return = new Map();
            	v_gridList.forEach(vv_grids => {
            		vv_grids.forEach(vv_cords =>{
            			let tt_id = vv_cords.join("_");
            			if(!t_return.has(tt_id)){
            				t_return.set(tt_id, vv_cords);
            			}
            		});
            	});
            	return t_return;
        	}, findBestGrid = (v_pID, v_gridList, vv_code) => {
            	let t_neighbors = this.mapToArray(v_points[v_pID].FinishedNeighbors, "entries"),
            		t_waitingGrids = new Map(),
            		t_boundaryNgh = false;
        		if(false){//二分准则
	                t_neighbors.forEach(vv_nghEntry => {
	                	let tt_ind = vv_nghEntry[0], tt_dist = vv_nghEntry[1];
	                    if(v_gridList.has(tt_ind)){
	                    	let tt_grids = v_gridList.get(tt_ind),
	                    		tt_score = this.getScore(tt_dist, 0);
	                        tt_grids.forEach(vv_cords =>{
	                        	let tt_y = vv_cords[0], tt_x = vv_cords[1];
	                        	t_waitingGrids.set(vv_cords.join("_"), vv_cords);
	                        	v_grids.getScore(vv_cords, tt_score);
	                        });
	                        t_boundaryNgh = true;
	                    }
	                });
	                if(!t_boundaryNgh || t_waitingGrids.size == 0){
	                	t_waitingGrids = getUnionList(v_gridList);
		                t_neighbors.forEach(vv_nghEntry => {
		                	let tt_ind = vv_nghEntry[0],
		                		tt_dist = vv_nghEntry[1],
		                		tt_cords = v_points[tt_ind].cords;
		                	t_waitingGrids.forEach(vv_cords => {
		                		let tt_cordDist = v_grids.getDistance(tt_cords, vv_cords),
		                			tt_aPos = v_grids[tt_cords[0]][tt_cords[1]].pos,
		                			tt_bPos = v_grids[vv_cords[0]][vv_cords[1]].pos,
		                			tt_codeDist = v_codes?(v_codes.getCodeDist(tt_aPos, tt_bPos)):0,
		                			tt_score = this.getScore(tt_dist, tt_cordDist, tt_codeDist);
	                        	v_grids.getScore(vv_cords, tt_score);
		                	});
		                });
	                }
        		}else{//统一准则
                	t_waitingGrids = getUnionList(v_gridList);
                    // if(vv_code == "0111"){
                    //     console.log(t_neighbors);
                    // }
                    let tt_code = v_codes.getCode(v_pID);
	                t_neighbors.forEach(vv_nghEntry => {
	                	let tt_ind = vv_nghEntry[0],
	                		tt_dist = vv_nghEntry[1],
	                		tt_cords = v_points[tt_ind].cords;
	                	t_waitingGrids.forEach(vv_cords => {
	                		let tt_cordDist = v_grids.getDistance(tt_cords, vv_cords),
	                			tt_aPos = v_grids[tt_cords[0]][tt_cords[1]].pos,
	                			tt_bPos = v_grids[vv_cords[0]][vv_cords[1]].pos,
	                			tt_codeDist = v_codes?(v_codes.getCodeDist(tt_aPos, tt_bPos)):0,
	                			tt_score = this.getScore(tt_dist, tt_cordDist, tt_codeDist);
                        	v_grids.getScore(vv_cords, tt_score);
	                	});
	                });
        		}
        		let t_finalCords = v_grids.getExtreamScore(t_waitingGrids);
        		if(t_finalCords.length == 1){
        			t_finalCords = t_finalCords[0];
        		}else{
        			if(false){
        				let t_pos = new Map();
        				t_finalCords.forEach(vv_cords => {
        					t_pos.set(vv_cords.join("_"), v_grids[vv_cords[0]][vv_cords[1]].pos);
        				});
        				t_finalCords = v_codes.choose(v_pID, t_pos);
        			}else{
	        			let t_ind = 0;//Math.floor(Math.random() * t_finalCords.length);
	        			t_finalCords = t_finalCords[t_ind];
        			}
        		}
                v_grids.clearScores();
                return t_finalCords;
            }, packResults = () => {
            	let t_return = new Array(v_grids.length);
            	v_grids.forEach((v_row, v_i) =>{
            		let t_row = v_row.map(v_ele => {
            			return {
            				id: v_ele.pIndex,
            				pos: v_ele.pos,
            				gridNeighbors: v_ele.neighbors,
                            dataNeighbors: (v_ele.pIndex == null)?null:(this.mapToArray(v_points[v_ele.pIndex].neighbors, "keys")),
                            code: (v_ele.pIndex == null)?null:(v_codes.dictionary[v_ele.pIndex]),
            			}
            		});
            		t_return[v_i] = t_row;
            	});
            	t_return.radius = v_grids.radius;
                t_return.getCenterPID = function(){ return v_grids.getCenterPID();};
            	return t_return;
            };
            let t_gridNum = v_grids.gridNum,
            	t_centerPoint = v_points.getCenter(),
            	t_centerGrid = v_grids.getCenter(),
            	t_stop = false,
            	t_next = assign(t_centerPoint, t_centerGrid);
            while(!t_stop){
                if(t_next != null && v_grids.waitingList.size > 0){
                	let t_cords = findBestGrid(t_next, v_grids.waitingList, v_codes.getCode(t_next));
                	t_next = assign(t_next, t_cords);
                }else{
                    t_stop = true;
                }
            }
            if(t_next != null && v_grids.waitingList.size == 0){
                return "Hexagons not enough!";
            }else{
            	return packResults();
            }
        },

        getMap: function(v_nghList, v_distMat, v_codeBook, v_gridType = "hexagon", v_factor = 1.2){
        	let t_points = this.getPoints(v_nghList, v_distMat),
        		t_grids = this.getGrids(v_distMat.length, v_gridType, v_factor),
        		t_codes = this.getCodes(v_codeBook);
        		return this.getGridMap(t_points, t_grids, t_codes);
        },
    };
})();




            // t_links = v_diagram.links();
            // for(let t_i = 0; t_i < t_points.length; t_i++){
            //     t_points[t_i] = t_pointObj(t_i);
            // }
            // t_links.forEach(function(vv_link){
            //     let tt_source = vv_link.source,
            //         tt_target = vv_link.target;
            //     let tt_sind = t_diagram.find(tt_source[0], tt_source[1]).index,
            //         tt_tind = t_diagram.find(tt_target[0], tt_target[1]).index,
            //         t_dist = Basic.getDistance(tt_source, tt_target);
            //     t_points[tt_sind].neighbors.set(tt_tind, t_distObj(tt_tind, t_dist));
            //     t_points[tt_tind].neighbors.set(tt_sind, t_distObj(tt_sind, t_dist));
            // });




            // t_grids.findNextHexagons = function(v_list){
            //     let t_neighbors = new Map(), t_empty = true;
            //     for(let t_i = 0; t_i < v_list.length; t_i++){
            //         let tt_neighbors = this.findNeighborHexagons(v_list[t_i][0], v_list[t_i][1]);
            //         if(!tt_neighbors){
            //             continue;
            //         }
            //         t_empty = false;
            //         t_neighbors.set(v_list[t_i].join("_"), tt_neighbors);
            //     }
            //     if(t_empty){
            //         return null;
            //     }else{
            //         return t_neighbors;
            //     }
            // };



                // let t_finalList = Basic.mapValues(t_nghHexList), t_maxInd = [], t_maxScore = 0;
                // t_finalList.forEach(vv_cords => {
                //     let t_score = v_grids[vv_cords[0]][vv_cords[1]].score;
                //     if(t_score > t_maxScore){
                //         t_maxInd = [vv_cords];
                //         t_maxScore = t_score;
                //     }else{
                //         if(t_score == t_maxScore){
                //             t_maxInd.push(vv_cords);
                //             t_maxScore = t_score;
                //         }
                //     }
                // });
                // let t_finalCords;
                // if(t_maxInd.length == 1){
                //     t_finalCords = t_maxInd[0];
                // }else{
                //     let t_minScore = Infinity, t_minCords = [], t_maxDot = 0, t_maxDotCords = null;
                //     let t_nearestHex = v_points[t_minInd].cords,
                //         t_nearestPos = v_grids[t_nearestHex[0]][t_nearestHex[1]].pos;
                //     let t_nearestP = v_distMat[t_minInd],
                //         t_point = v_distMat[v_pID],
                //         t_div = numeric.sub(t_point, t_nearestP);
                //     t_maxInd.forEach(vv_cords => {
                //         let tt_pos = v_grids[vv_cords[0]][vv_cords[1]].pos,
                //             tt_div = numeric.sub(tt_pos, t_nearestPos),
                //             t_hexDist = Basic.getDistance(tt_pos, t_nearestPos),
                //             t_dot = numeric.dot(t_div, tt_div);
                //             if(t_hexDist < t_minScore || (Math.abs(t_hexDist - t_minScore) > 1e-5)){
                //                 t_minScore = t_hexDist;
                //                 t_minCords = [{
                //                     cords: vv_cords,
                //                     dot: t_dot,
                //                 }];
                //                 t_maxDot = t_dot;
                //                 t_maxDotCords = vv_cords;
                //             }else{
                //                 if((Math.abs(t_hexDist - t_minScore) <= 1e-5)){
                //                     t_minCords.push({
                //                         cords: vv_cords,
                //                         dot: t_dot,
                //                     });
                //                     if(t_dot > t_maxDot){
                //                         t_maxDot = t_dot;
                //                         t_maxDotCords = vv_cords;
                //                     }
                //                 }
                //             }
                //             if(t_minCords.length == 1){
                //                 t_finalCords = t_minCords[0].cords;
                //             }else{
                //                 t_finalCords = t_maxDotCords;
                //             }
                //     });
                // }