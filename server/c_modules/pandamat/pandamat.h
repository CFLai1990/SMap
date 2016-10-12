#ifndef PANDAMAT_H
#define PANDAMAT_H
#include <iostream>  
#include <stdlib.h>
#include <map>
#include <string>
#include <node.h>
#include <v8.h>
#include <armadillo>
#include "operation.h"
#include "opercollection.h"
  
using namespace std;
using namespace node;
using namespace v8;
using namespace arma;

class PandaMat{
public:
	PandaMat();
	Local<Value> Operate(const FunctionCallbackInfo<Value>& args, char* v_command, Isolate* v_isolate);
protected:
	void unpackArray(Local<Value> v_arr, parameterType& v_type, mat& v_data);
	mat getResult(OperationResult& v_result);
	bool getState();
	void packArray(mat& v_data);
	Local<Object> packResult(mat& v_data);
private:
	OperationCollection operations;
	map<string, int> expTypes;
	string stateMessage;
	exceptions stateCode;
	Local<Array> resultMat;
	Isolate* isolate;
};
#endif