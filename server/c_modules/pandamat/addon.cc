#include "pandamat.h"

void Add(const FunctionCallbackInfo<Value>& args){
  	Isolate* isolate = args.GetIsolate();
	HandleScope scope(isolate);
	PandaMat myPanda;
	Local<Value> result = myPanda.Operate(args, "add", isolate);
	args.GetReturnValue().Set(result);
}

void init(Local<Object> target){
	NODE_SET_METHOD(target, "add", Add);
}

NODE_MODULE(pandamat, init);