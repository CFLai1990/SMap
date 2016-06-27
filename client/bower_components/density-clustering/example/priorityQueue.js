var PriorityQueue = require('../lib/index.js').PriorityQueue;

var p = new PriorityQueue();
p.insert(1, 4);
p.insert(2, 1);
p.insert(3, 2);
p.insert(4, 3);
p.insert(4, 5);
console.log(p.getElements());

var p = new PriorityQueue([1,2,3,4,4], [4,1,2,3,5]);
console.log(p.getElements());