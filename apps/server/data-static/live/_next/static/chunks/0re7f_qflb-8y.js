(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,897823,e=>{"use strict";let t;e.i(21770);var i,r,a,s,o,n,u,l,d,h,p=e.i(431205);let c=(0,p.env)();c.registerFlag("WEBGPU_DEFERRED_SUBMIT_BATCH_SIZE",()=>15),c.registerFlag("WEBGPU_CPU_FORWARD",()=>!0),c.registerFlag("WEBGPU_MATMUL_PROGRAM_TYPE",()=>-1),c.registerFlag("WEBGPU_USE_NAIVE_CONV2D_TRANSPOSE",()=>!0),c.registerFlag("WEBGPU_USE_LOW_POWER_GPU",()=>!1),c.registerFlag("WEBGPU_CPU_HANDOFF_SIZE_THRESHOLD",()=>1e3),c.registerFlag("WEBGPU_USE_PROFILE_TOOL",()=>!1),c.registerFlag("WEBGPU_IMPORT_EXTERNAL_TEXTURE",()=>!0),c.registerFlag("WEBGPU_USE_NAIVE_CONV2D_DEBUG",()=>!1),c.registerFlag("WEBGPU_THRESHOLD_TO_INCREASE_WORKGROUPS_FOR_MATMUL",()=>-1),c.registerFlag("WEBGPU_CONV_SEPARATE_IM2COL_SHADER",()=>!1),c.registerFlag("WEBGPU_PRINT_SHADER",()=>""),c.registerFlag("WEBGPU_ENGINE_COMPILE_ONLY",()=>!1);var f=e.i(889501),m=e.i(829576),g=e.i(373192),x=e.i(759026),y=e.i(460884);class w{constructor(e){e&&(this.vendor=e.vendor,this.architecture=e.architecture,this.intelGPUGeneration=this.getIntelGPUGeneration())}getIntelGPUGeneration(){if(this.isIntel()){if(this.architecture.startsWith("gen"))return Number(this.architecture.match(/\d+/));else if(this.architecture.startsWith("xe"))return 12}return 0}isIntel(){return"intel"===this.vendor}}class b{constructor(e){this.device=e,this.numUsedBuffers=0,this.numFreeBuffers=0,this.freeBuffers=new Map,this.usedBuffers=new Map,this.numBytesUsed=0,this.numBytesAllocated=0}acquireBuffer(e,t,i=!1,r=!0){var a,s;let o,n=(a=e,s=t,`${a}_${s}`);return r?(this.freeBuffers.has(n)||this.freeBuffers.set(n,[]),this.freeBuffers.get(n).length>0?(o=this.freeBuffers.get(n).pop(),this.numFreeBuffers--):(o=this.device.createBuffer({size:e,usage:t,mappedAtCreation:i}),this.numBytesAllocated+=e)):(o=this.device.createBuffer({size:e,usage:t,mappedAtCreation:i}),this.numBytesAllocated+=e),this.usedBuffers.has(n)||this.usedBuffers.set(n,[]),this.usedBuffers.get(n).push(o),this.numUsedBuffers++,this.numBytesUsed+=e,o}releaseBuffer(e,t=!0){var i,r;if(0===this.freeBuffers.size)return;let a=e.size,s=(i=a,r=e.usage,`${i}_${r}`),o=this.usedBuffers.get(s),n=o.indexOf(e);if(n<0)throw Error("Cannot find the buffer in buffer manager");o[n]=o[o.length-1],o.pop(),this.numUsedBuffers--,this.numBytesUsed-=a,t?(this.freeBuffers.get(s).push(e),this.numFreeBuffers++):(e.destroy(),this.numBytesAllocated-=a)}getNumUsedBuffers(){return this.numUsedBuffers}getNumFreeBuffers(){return this.numFreeBuffers}dispose(){this.freeBuffers.forEach((e,t)=>{e.forEach(e=>{e.destroy()})}),this.usedBuffers.forEach((e,t)=>{e.forEach(e=>{e.destroy()})}),this.freeBuffers=new Map,this.usedBuffers=new Map,this.numUsedBuffers=0,this.numFreeBuffers=0,this.numBytesUsed=0,this.numBytesAllocated=0}}class C{constructor(e){this.device=e,this.numUsedTextures=0,this.numFreeTextures=0,this.freeTextures=new Map,this.usedTextures=new Map,this.numBytesUsed=0,this.numBytesAllocated=0}acquireTexture(e,t,i,r){let a=e*t*v(i),s=S(e,t,i,r);if(this.freeTextures.has(s)||this.freeTextures.set(s,[]),this.usedTextures.has(s)||this.usedTextures.set(s,[]),this.numBytesUsed+=a,this.numUsedTextures++,this.freeTextures.get(s).length>0){this.numFreeTextures--;let e=this.freeTextures.get(s).shift();return this.usedTextures.get(s).push(e),e}this.numBytesAllocated+=a;let o=this.device.createTexture({size:[e,t],format:i,usage:r});return this.usedTextures.get(s).push(o),o}releaseTexture(e){if(0===this.freeTextures.size)return;let t=e.width,i=e.height,r=e.format,a=S(t,i,r,e.usage);this.freeTextures.has(a)||this.freeTextures.set(a,[]),this.freeTextures.get(a).push(e),this.numFreeTextures++,this.numUsedTextures--;let s=this.usedTextures.get(a),o=s.indexOf(e);if(o<0)throw Error("Cannot release a texture that was never provided by this texture manager");s.splice(o,1);let n=t*i*v(r);this.numBytesUsed-=n}getNumUsedTextures(){return this.numUsedTextures}getNumFreeTextures(){return this.numFreeTextures}dispose(){this.freeTextures.forEach((e,t)=>{e.forEach(e=>{e.destroy()})}),this.usedTextures.forEach((e,t)=>{e.forEach(e=>{e.destroy()})}),this.freeTextures=new Map,this.usedTextures=new Map,this.numUsedTextures=0,this.numFreeTextures=0,this.numBytesUsed=0,this.numBytesAllocated=0}}function S(e,t,i,r){return`${e}_${t}_${i}_${r}`}function v(e){if("rgba8unorm"===e)return 16;throw Error(`${e} is not supported!`)}let I=(e,t,i)=>"int32"===i?`atomicAdd(${e}, bitcast<i32>(${t}));`:`
          {
            var oldValue = 0;
            loop {
              let newValueF32 = bitcast<f32>(oldValue) + (${t});
              let newValue = bitcast<i32>(newValueF32);
              let res = atomicCompareExchangeWeak(${e}, oldValue, newValue);
              if res.exchanged {
                break;
              }
              oldValue = res.old_value;
            }
          }`;(i=n||(n={}))[i.FROM_PIXELS=0]="FROM_PIXELS",i[i.DRAW=1]="DRAW";let k=(e,t="f32")=>{switch(e){case 1:return`${t}`;case 2:return`vec2<${t}>`;case 3:return`vec3<${t}>`;case 4:return`vec4<${t}>`;default:throw Error(`${e}-component ${t} is not supported.`)}};function R(e){if(e<=1)return"i32";if(2===e)return"vec2<i32>";if(3===e)return"vec3<i32>";if(4===e)return"vec4<i32>";if(5===e)return"vec5";else if(6===e)return"vec6";else throw Error(`GPU for rank ${e} is not yet supported`)}function $(e){if(0===e)return"x";if(1===e)return"y";if(2===e)return"z";if(3===e)return"w";if(4===e)return"u";else if(5===e)return"v";else throw Error(`Index ${e} is not yet supported`)}function P(...e){let t;switch(e.length){case 0:t=`
        fn main()
      `;break;case 1:t=`
        fn main(${e[0]} : i32)
      `;break;default:throw Error("Unreachable")}return t}function z(e,t){var i;return`
     ${i=t,`
  @compute @workgroup_size(${i.workgroupSize[0]}, ${i.workgroupSize[1]}, ${i.workgroupSize[2]})
`}
      fn _start(@builtin(local_invocation_id) LocalId : vec3<u32>,
                @builtin(global_invocation_id) GlobalId : vec3<u32>,
                @builtin(local_invocation_index) LocalIndex: u32,
                @builtin(workgroup_id) WorkgroupId : vec3<u32>,
                @builtin(num_workgroups) NumWorkgroups : vec3<u32>) {
        localId = LocalId;
        localIndex = LocalIndex;
        globalId = GlobalId;
        numWorkgroups = NumWorkgroups;
        workgroupId = WorkgroupId;
        ${e?"main(getGlobalIndex());":"main();"};
      }
    `}let A=`
  struct vec5 {x: i32, y: i32, z: i32, w: i32, u: i32};
  struct vec6 {x: i32, y: i32, z: i32, w: i32, u: i32, v: i32};

  // Checks whether coordinates lie within the bounds of the shape.
  fn coordsInBounds2D(coord : vec2<i32>, shape : vec2<i32>) -> bool {
    return all(coord >= vec2<i32>(0)) && all(coord < shape);
  }
  fn coordsInBounds3D(coord : vec3<i32>, shape : vec3<i32>) -> bool {
    return all(coord >= vec3<i32>(0)) && all(coord < shape);
  }
  fn coordsInBounds4D(coord : vec4<i32>, shape : vec4<i32>) -> bool {
    return all(coord >= vec4<i32>(0)) && all(coord < shape);
  }

  fn getIndexFromCoords1D(coord : i32, shape : i32) -> i32 {
    return coord;
  }
  fn getIndexFromCoords2D(coords : vec2<i32>, shape : vec2<i32>) -> i32 {
    return dot(coords, vec2<i32>(shape.y, 1));
  }
  fn getIndexFromCoords3D(coords : vec3<i32>, shape : vec3<i32>) -> i32 {
    return dot(coords, vec3<i32>(shape.y * shape.z, shape.z, 1));
  }
  fn getIndexFromCoords4D(coords : vec4<i32>, shape : vec4<i32>) -> i32 {
    return dot(coords, vec4<i32>(
        shape.y * shape.z * shape.w, shape.z * shape.w, shape.w, 1));
  }
  fn getIndexFromCoords5D(coords : vec5, shape : vec5) -> i32 {
    let shapeStrides: vec5 = vec5(shape.y * shape.z * shape.w * shape.u, shape.z * shape.w * shape.u, shape.w * shape.u, shape.u, 1);
    return coords.x*shapeStrides.x + coords.y*shapeStrides.y + coords.z*shapeStrides.z + coords.w*shapeStrides.w + coords.u*shapeStrides.u;
  }
  fn getIndexFromCoords6D(coords : vec6, shape : vec6) -> i32 {
    let shapeStrides: vec6 = vec6(shape.y * shape.z * shape.w * shape.u * shape.v, shape.z * shape.w * shape.u * shape.v, shape.w * shape.u * shape.v, shape.u * shape.v, shape.v, 1);
    return coords.x*shapeStrides.x + coords.y*shapeStrides.y + coords.z*shapeStrides.z + coords.w*shapeStrides.w + coords.u*shapeStrides.u + coords.v*shapeStrides.v;
  }

  // NaN defination in IEEE 754-1985 is :
  //   - sign = either 0 or 1.
  //   - biased exponent = all 1 bits.
  //   - fraction = anything except all 0 bits (since all 0 bits represents infinity).
  // https://en.wikipedia.org/wiki/IEEE_754-1985#Representation_of_non-numbers
  fn isnan(val: f32) -> bool {
    let floatToUint: u32 = bitcast<u32>(val);
    return (floatToUint & 0x7fffffffu) > 0x7f800000u;
  }
  fn isnanVec4(val : vec4<f32>) -> vec4<bool> {
    let floatToUint: vec4<u32> = bitcast<vec4<u32>>(val);
    return (floatToUint & vec4<u32>(0x7fffffffu)) > vec4<u32>(0x7f800000u);
  }
`,N=`
  fn isinf(val: f32) -> bool {
    return abs(val) == uniforms.INFINITY;
  }
`;function D(e,t=""){let i,r=e.length,a=""!==t?`get${t.charAt(0).toUpperCase()+t.slice(1)}CoordsFromIndex`:"getCoordsFromIndex",s=""!==t?`${t.charAt(0).toLowerCase()+t.slice(1)}ShapeStrides`:"outShapeStrides";if(r<=1)return`fn ${a}(index : i32) -> i32 { return index; }`;let o=y.util.computeStrides(e),n=R(r),u=[];for(let e=0;e<r;e++)u.push(`d${e}`);return 1===o.length?`    fn ${a}(index : i32) -> vec2<i32> {
      let d0 = index / uniforms.${s}; let d1 = index - d0 * uniforms.${s};
      return vec2<i32>(d0, d1);
    }`:(i="var index2 = index;"+o.map((e,t)=>{let i=`let ${u[t]} = index2 / uniforms.${s}.${$(t)}`,r=t===o.length-1?`let ${u[t+1]} = index2 - ${u[t]} * uniforms.${s}.${$(t)}`:`index2 = index2 - ${u[t]} * uniforms.${s}.${$(t)}`;return`${i}; ${r};`}).join(""),`
    fn ${a}(index : i32) -> ${n} {
      ${i}
      return ${n}(${u.join(",")});
    }
  `)}function T(e){return 1===e.dispatch[1]&&1===e.dispatch[2]}function F(e,t=1){if("float32"===e)return k(t,"f32");if("int32"===e||"bool"===e)return k(t,"i32");throw Error(`type ${e} is not supported.`)}function _(e){return!(e.dispatchLayout.hasOwnProperty("y")&&0!==e.dispatchLayout.y.length||e.dispatchLayout.hasOwnProperty("z")&&0!==e.dispatchLayout.z.length)}let E=e=>{let t=1;for(let i=0;i<e.length;i++)t*=e[i];return t};function L(e,t,i=[1,1,1],r=[1,1,1]){let[a,s,o]=[Math.ceil(E(e.x.map(e=>t[e]))/(i[0]*r[0])),e.y?Math.ceil(E(e.y.map(e=>t[e]))/(i[1]*r[1])):1,e.z?Math.ceil(E(e.z.map(e=>t[e]))/(i[2]*r[2])):1];return[a,s,o]}function B(e,t,i,r=!1){let a=[8,8,1],s=[4,4,1];return!r&&(e<=8&&(s[1]=1),t<=16&&i<=16&&(a[0]=4)),{workgroupSize:a,elementsPerThread:s}}function W(e,t,i=!1){if(i)return[8,8,1];let r=E(e.x.map(e=>t[e])),a=E(e.y.map(e=>t[e]));return r<=4?[4,16,1]:a<=4?[16,4,1]:[16,16,1]}function O(e,t,i=!1){if(i)return[4,4,1];let r=E(e.x.map(e=>t[e])),a=E(e.y.map(e=>t[e]));return r<=4?[1,2,1]:a<=4?[2,1,1]:[2,2,1]}function U(e){return{x:e.map((e,t)=>t)}}function M(e){if("float32"===e||"int32"===e||"bool"===e||"string"===e)return 4;if("complex64"===e)return 8;throw Error(`Unknown dtype ${e}`)}function V(){return!!("u">typeof globalThis&&globalThis.navigator&&globalThis.navigator.gpu)}function G(e,t){Array.isArray(e)||(e=[e]),e.forEach(e=>{null!=e&&y.util.assert("complex64"!==e.dtype,()=>`${t} does not support complex64 tensors in the WebGPU backend.`)})}(r=u||(u={}))[r.MatMulReduceProgram=0]="MatMulReduceProgram",r[r.MatMulSplitKProgram=1]="MatMulSplitKProgram",r[r.MatMulSmallOutputSizeProgram=2]="MatMulSmallOutputSizeProgram",r[r.MatMulPackedProgram=3]="MatMulPackedProgram",r[r.MatMulMax=4]="MatMulMax",e.s(["GPUBytesPerElement",0,M,"MatMulProgramType",0,u,"assertNotComplex",0,G,"computeDispatch",0,L,"computeWorkPerThreadForConv2d",0,O,"computeWorkgroupInfoForMatMul",0,B,"computeWorkgroupSizeForConv2d",0,W,"flatDispatchLayout",0,U,"isWebGPUSupported",0,V,"tilesFitEvenlyIntoShape",0,function(e,t){if(e.length!==t.length)throw Error(`Cannot compute whether rank ${e.length} tiles fit evenly into rank ${t.length} shape - ranks must match.`);return t.every((t,i)=>t%e[i]==0)}],889135);let H=(0,p.env)().getNumber("WEBGPU_CPU_HANDOFF_SIZE_THRESHOLD");class X extends x.KernelBackend{nextDataId(){return X.nextDataId++}constructor(e,t){if(super(),this.commandQueueOwnedIds=new WeakSet,this.dispatchCountInPass=0,this.disposed=!1,this.downloadWaitMs=0,this.tensorDataPendingDisposal=[],this.queryResolveBuffer=null,this.querySet=null,this.querySetCount=2,this.stagingPendingDisposal=[],this.uniformPendingDisposal=[],this.uploadWaitMs=0,this.hasReadSyncWarned=!1,this.hasTimestampQueryWarned=!1,!V())throw Error("WebGPU is not supported on this device");this.pipelineCache={},this.device=e,this.queue=e.queue,this.commandEncoder=null,this.computePassEncoder=null,this.adapterInfo=new w(t),this.supportTimestampQuery=this.device.features.has("timestamp-query"),this.thresholdToIncreaseWorkgroups=this.adapterInfo.intelGPUGeneration>=12?16:8,this.bufferManager=new b(this.device),this.textureManager=new C(this.device),this.tensorMap=new x.DataStorage(this,(0,f.engine)()),(0,p.env)().getBool("WEBGPU_USE_PROFILE_TOOL")&&(this.dummyCanvas=document.createElement("canvas"),this.dummyCanvas.width=1,this.dummyCanvas.height=1,this.dummyContext=this.dummyCanvas.getContext("webgpu"),this.dummyContext.configure({device:e,format:"bgra8unorm"}),document.body.appendChild(this.dummyCanvas))}floatPrecision(){return 32}disposeData(e,t=!1){if(!this.tensorMap.has(e))return!0;let i=this.tensorMap.get(e);return t?i.refCount=0:i.refCount--,!(i.refCount>0)&&((null!=i.complexTensorInfos&&(this.disposeData(i.complexTensorInfos.real.dataId),this.disposeData(i.complexTensorInfos.imag.dataId)),this.commandQueueOwnedIds.has(e))?this.tensorDataPendingDisposal.push(e):(this.releaseResource(e),this.tensorMap.delete(e)),!0)}memory(){return{numBytesInGPU:this.bufferManager.numBytesUsed,numBytesAllocatedInGPU:this.bufferManager.numBytesAllocated,unreliable:!1}}releaseResource(e){let t=this.tensorMap.get(e);if(t&&t.resource){if(t.external){t.resource=null;return}t.resource instanceof GPUBuffer?this.bufferManager.releaseBuffer(t.resource):t.resource instanceof GPUTexture&&this.textureManager.releaseTexture(t.resource),t.resource=null}}refCount(e){return this.tensorMap.has(e)?this.tensorMap.get(e).refCount:0}incRef(e){let t=this.tensorMap.get(e);t.refCount++}decRef(e){if(this.tensorMap.has(e)){let t=this.tensorMap.get(e);t.refCount--}}write(e,t,i){if("complex64"===i&&null!=e)throw Error("Cannot write to a complex64 dtype. Please use tf.complex(real, imag).");let r={id:this.nextDataId()};return this.tensorMap.set(r,{dtype:i,shape:t,values:e,refCount:1}),r}move(e,t,i,r,a){if("complex64"===r)throw Error("Cannot write to a complex64 dtype. Please use tf.complex(real, imag).");this.tensorMap.set(e,{dtype:r,shape:i,values:t,refCount:a})}submitQueue(){this.queue.submit([this.commandEncoder.finish()]),this.commandEncoder=null,this.dispatchCountInPass=0,this.commandQueueOwnedIds=new WeakSet,this.tensorDataPendingDisposal.forEach(e=>{this.releaseResource(e),this.tensorMap.delete(e)}),this.uniformPendingDisposal.forEach(e=>this.bufferManager.releaseBuffer(e)),this.stagingPendingDisposal.forEach(e=>this.bufferManager.releaseBuffer(e,!1)),this.tensorDataPendingDisposal=[],this.uniformPendingDisposal=[],this.stagingPendingDisposal=[]}ensureCommandEncoderReady(){this.commandEncoder||(this.commandEncoder=this.device.createCommandEncoder())}endComputePassEncoder(){this.computePassEncoder&&(this.computePassEncoder.end(),this.computePassEncoder=null)}async checkCompileCompletionAsync(){let e;try{e=await Promise.all(Object.values(this.pipelineCache))}catch(e){throw Error(e.message)}Object.keys(this.pipelineCache).map((t,i)=>{this.pipelineCache[t]=e[i]})}async getBufferData(e){if((0,p.env)().getBool("WEBGPU_ENGINE_COMPILE_ONLY"))return console.warn("The data may be invalid since WEBGPU_ENGINE_COMPILE_ONLY is true, this can only be called when WEBGPU_ENGINE_COMPILE_ONLY is false"),null;let t=e.size,i=this.bufferManager.acquireBuffer(t,GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ);this.ensureCommandEncoderReady(),this.endComputePassEncoder(),this.commandEncoder.copyBufferToBuffer(e,0,i,0,t),this.submitQueue(),await i.mapAsync(GPUMapMode.READ);let r=i.getMappedRange().slice(0);return i.unmap(),null!=i&&this.bufferManager.releaseBuffer(i),(0,p.env)().getBool("WEBGPU_USE_PROFILE_TOOL")&&(y.util.assert(void 0!==this.dummyContext,()=>"Fail to get context for profiling tool"),this.dummyContext.getCurrentTexture()),r}convertAndCacheOnCPU(e,t){let i=this.tensorMap.get(e);return i.values=t,i.values}readSync(e){let t=this.tensorMap.get(e),{values:i,complexTensorInfos:r}=t;if(null!=i||"string"===t.dtype)return i;if("complex64"===t.dtype){let t=this.readSync(r.real.dataId),i=this.readSync(r.imag.dataId),a=y.util.convertBackendValuesAndArrayBuffer(m.backend_util.mergeRealAndImagArrays(t,i).buffer,"float32");return this.convertAndCacheOnCPU(e,a),a}this.hasReadSyncWarned||(this.hasReadSyncWarned=!0,console.warn("The performance of synchronously reading data from GPU to CPU is poor on the webgpu backend, please use asynchronous APIs instead."));let a=["opaque","premultiplied"],s=t.resource,o=s.size;y.util.assert(o%4==0,()=>"Because there is 4 bytes for one pixel, buffer size must be multiple of 4.");let n=o/4,u=new ArrayBuffer(o),l=a.map(e=>new OffscreenCanvas(256,256)),d=new OffscreenCanvas(256,256);this.endComputePassEncoder(),l.map((e,t)=>{let i=e.getContext("webgpu");return i.configure({device:this.device,format:"bgra8unorm",usage:GPUTextureUsage.COPY_DST,alphaMode:a[t]}),i.getCurrentTexture()}).map((e,t)=>{let i=(i,r,o)=>{this.ensureCommandEncoderReady(),this.commandEncoder.copyBufferToTexture({buffer:s,bytesPerRow:1024,offset:o},{texture:e},{width:i,height:r}),this.submitQueue();let n=d.getContext("2d",{willReadFrequently:!0});n.clearRect(0,0,i,r),n.drawImage(l[t],0,0);let h=n.getImageData(0,0,i,r).data,p=a[t],c=new Uint8ClampedArray(u,o,i*r*4);for(let e=0;e<c.length;e+=4)if("premultiplied"===p)c[e+3]=h[e+3];else{let t=h[e];c[e]=h[e+2],c[e+1]=h[e+1],c[e+2]=t}},r=Math.floor(n/65536),o=256,h=256,p=0;for(let e=0;e<r;e++)i(o,h,p),p+=262144;let c=n%65536;(h=Math.floor(c/256))>0&&(i(o,h,p),p+=1024*h),(o=c%256)>0&&i(o,1,p)});let h=y.util.convertBackendValuesAndArrayBuffer(u,t.dtype);return this.convertAndCacheOnCPU(e,h),h}async read(e){let t;if(!this.tensorMap.has(e))throw Error(`Tensor ${e} was not registered!`);let i=this.tensorMap.get(e),{values:r}=i;if(null!=r)return r;if("complex64"===i.dtype){let e=await Promise.all([this.read(i.complexTensorInfos.real.dataId),this.read(i.complexTensorInfos.imag.dataId)]),r=e[0],a=e[1];t=m.backend_util.mergeRealAndImagArrays(r,a)}else{let e=await this.getBufferData(i.resource);t=y.util.convertBackendValuesAndArrayBuffer(e,i.dtype)}return this.convertAndCacheOnCPU(e,t),t}copyBuffer(e){let t=e.size,i=e.usage,r=this.bufferManager.acquireBuffer(t,i);return this.ensureCommandEncoderReady(),this.endComputePassEncoder(),this.commandEncoder.copyBufferToBuffer(e,0,r,0,t),this.submitQueue(),r}createTensorFromGPUData(e,t,i){let r=e.buffer;if("complex64"===i)throw Error("Cannot write to a complex64 dtype. ");let a={id:this.nextDataId()};this.tensorMap.set(a,{dtype:i,shape:t,values:null,refCount:1,external:e.zeroCopy});let s=this.tensorMap.get(a),o=M(s.dtype)*y.util.sizeFromShape(s.shape);if(e.buffer.size<o)throw Error(`GPUBuffer size(${e.buffer.size}) is smaller than tensor size(${o})!`);if((e.buffer.usage&(GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC))!=(GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC))throw Error("GPUBuffer.usage should include GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC!");return!0!==e.zeroCopy&&(r=this.copyBuffer(r)),s.resource=r,(0,f.engine)().makeTensorFromDataId(a,t,i,this)}readToGPU(e){let{values:t,dtype:i,shape:r,resource:a}=this.tensorMap.get(e);if("complex64"===i)throw Error("Does not support reading buffer for complex64 dtype.");if(null==a)if(null!=t)throw Error("Data is not on GPU but on CPU.");else throw Error("There is no data on GPU or CPU.");let s=a.size,o=a.usage,n=this.bufferManager.acquireBuffer(s,o);this.ensureCommandEncoderReady(),this.endComputePassEncoder(),this.commandEncoder.copyBufferToBuffer(a,0,n,0,s),this.submitQueue();let u=this.makeTensorInfo(r,i),l=(0,f.engine)().makeTensorFromTensorInfo(u);return this.tensorMap.get(u.dataId).resource=n,{tensorRef:l,buffer:n}}bufferSync(e){let t=this.readSync(e.dataId);if("string"===e.dtype)try{let i=t.map(e=>y.util.decodeString(e));return(0,g.buffer)(e.shape,e.dtype,i)}catch(e){throw Error("Failed to decode encoded string bytes into utf-8")}return(0,g.buffer)(e.shape,e.dtype,t)}async time(e){this.supportTimestampQuery||this.hasTimestampQueryWarned||(console.warn("This device doesn't support timestamp-query extension. Start Chrome browser with flag --enable-dawn-features=allow_unsafe_apis to try it again. Otherwise, zero will be shown for the kernel time when profiling mode is enabled."),this.hasTimestampQueryWarned=!0);let t=this.activeTimers,i=[],r=!1;null==this.programTimersStack?(this.programTimersStack=i,r=!0):this.activeTimers.push(i),this.activeTimers=i,e();let a=y.util.flatten(this.activeTimers.map(e=>e.query)).filter(e=>null!=e),s=y.util.flatten(this.activeTimers.map(e=>e.name)).filter(e=>null!=e);this.activeTimers=t,r&&(this.programTimersStack=null);let o={uploadWaitMs:this.uploadWaitMs,downloadWaitMs:this.downloadWaitMs,kernelMs:null,wallMs:null},n=await Promise.all(a);return o.kernelMs=y.util.sum(n),o.getExtraProfileInfo=()=>n.map((e,t)=>({name:s[t],ms:e})).map(e=>`${e.name}: ${e.ms}`).join(", "),this.uploadWaitMs=0,this.downloadWaitMs=0,o}makeTensorInfo(e,t,i){return"string"===t&&null!=i&&i.length>0&&y.util.isString(i[0])&&(i=i.map(e=>y.util.encodeString(e))),{dataId:this.write(i,e,t),shape:e,dtype:t}}tensorToBinding(e){if(!e)return null;let t=this.tensorMap.get(e.dataId).resource;return t instanceof GPUBuffer?{buffer:t}:t instanceof GPUTexture?t.createView():t}uploadToGPU(e){let t,i=this.tensorMap.get(e);if(null!=i.resource)return;let r=M(i.dtype)*y.util.sizeFromShape(i.shape),a=GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST;if(i.values){if("unmapped"===(t=this.bufferManager.acquireBuffer(r,a,!0)).mapState){let e=this.bufferManager.acquireBuffer(r,GPUBufferUsage.MAP_WRITE|GPUBufferUsage.COPY_SRC,!0,!1),a=e.getMappedRange();"int32"===i.dtype||"bool"===i.dtype?new Int32Array(a).set(i.values):new Float32Array(a).set(i.values),e.unmap(),this.ensureCommandEncoderReady(),this.endComputePassEncoder(),this.commandEncoder.copyBufferToBuffer(e,0,t,0,r),this.stagingPendingDisposal.push(e)}else{let e=t.getMappedRange();"int32"===i.dtype||"bool"===i.dtype?new Int32Array(e).set(i.values):new Float32Array(e).set(i.values),t.unmap()}i.values=null}else t=this.bufferManager.acquireBuffer(r,a);i.resource=t}makeUniforms(e){let t=0,i=0,r=[],a=1;e.forEach(e=>{let s;switch(0===e.data.length&&(e.data=[1]),e.data.length){case 1:s=4;break;case 2:s=8;break;case 3:case 4:case 5:case 6:s=16;break;default:y.util.assert(!1,()=>`Unsupported ${e.data.length}D shape`)}(5===i||6===i)&&(s=16),s>a&&(a=s),t=Math.ceil(t/s)*s,i=e.data.length,r.push(t),t+=4*e.data.length});let s=new ArrayBuffer(t=Math.ceil(t/a)*a);e.forEach((e,t)=>{let i=r[t];"int32"===e.type?new Int32Array(s,i,e.data.length).set(e.data):"uint32"===e.type?new Uint32Array(s,i,e.data.length).set(e.data):new Float32Array(s,i,e.data.length).set(e.data)});let o=this.bufferManager.acquireBuffer(t,GPUBufferUsage.COPY_DST|GPUBufferUsage.UNIFORM);return this.queue.writeBuffer(o,0,s,0,t),this.uniformPendingDisposal.push(o),{offset:0,size:t,buffer:o}}runWebGPUProgram(e,t,i,r,a){if(a||(a=this.makeTensorInfo(e.outputShape,i)),0===y.util.sizeFromShape(a.shape))return this.tensorMap.get(a.dataId).values=y.util.getTypedArrayFromDType(a.dtype,0),a;this.uploadToGPU(a.dataId),e.dispatch=((e,t)=>{let i=e.limits.maxComputeWorkgroupsPerDimension,r=t.dispatchLayout,a=t.dispatch;if(a.every(e=>e<=i))return a;y.util.assert(a[0]>i&&void 0===r.y&&void 0===r.z,()=>"Dispatch size exceeds WebGPU limits in Y or Z dimension.");let s=Math.ceil(Math.sqrt(a[0]));return s>i?(s=Math.ceil(Math.cbrt(a[0])),y.util.assert(s<=i,()=>"Total dispatch size exceeds WebGPU maximum."),[s,s,s]):[s,s,1]})(this.device,e);let s=t.map((t,i)=>{if("complex64"===t.dtype)throw Error("GPGPUProgram does not support complex64 input. For complex64 dtypes, please separate the program into real and imaginary parts.");return this.uploadToGPU(t.dataId),{dtype:this.tensorMap.get(t.dataId).dtype,shape:t.shape,name:e.variableNames[i]}});e.shaderKey=function(e,t,i){let r=e.shaderKey;if(null!=e.pixelsOpType)return r;let a=[],s=[];t.forEach(e=>{a.push(e.shape),s.push(e.dtype)}),a.push(i.shape),s.push(i.dtype);let o=t.map(e=>m.backend_util.getBroadcastDims(e.shape,i.shape)),n=t.map(e=>y.util.arraysEqual(e.shape,i.shape)).join("_"),u=o.map(e=>e.join("_")).join(";"),l=T(e)?"flatDispatch":"";return r+("_"+(e.workgroupSize?e.workgroupSize.join(","):"")+a.map(e=>e.length).join(",")+s.join(",")+e.variableNames.join(",")+u+n+l)}(e,s,a);let o=(0,p.env)().getBool("WEBGPU_ENGINE_COMPILE_ONLY");return e.shaderKey in this.pipelineCache||(this.pipelineCache[e.shaderKey]=((e,t,i,r,a)=>{let s=function(e,t,i){var r;let a,s=[],o=i.workgroupSize[0]*i.workgroupSize[1]*i.workgroupSize[2];if(i.outputComponent=i.outputComponent?i.outputComponent:1,s.push(`

      var<private> localId: vec3<u32>;
      var<private> localIndex: u32;
      var<private> globalId: vec3<u32>;
      var<private> numWorkgroups: vec3<u32>;
      var<private> workgroupId: vec3<u32>;

      // Only used when the y/z dimension of workgroup size is 1.
      fn getGlobalIndex() -> i32 {
        ${T(i)?"  return i32(globalId.x);":`  return i32((workgroupId.z * numWorkgroups.x * numWorkgroups.y +
                workgroupId.y * numWorkgroups.x + workgroupId.x) * ${o}u +
                localIndex);
        `}
      }
    `),null!=i.pixelsOpType){let r=i.pixelsOpType===n.FROM_PIXELS?`@group(0) @binding(0) var<storage, read_write> result: array<${F(t.dtype,i.outputComponent)}>;`:`@group(0) @binding(1) var<storage, read> inBuf : array<${F(e[0].dtype,i.outputComponent)}>;`,a=3===t.shape.length?"vec2<i32>":"i32";s.push(`
        struct Uniform {
          outShapeStrides : ${a},
          size            : i32,
          numChannels     : i32,
          alpha           : f32,
        };

        ${r}
        @group(0) @binding(2) var<uniform> uniforms: Uniform;
      `);let o=_(i);return[A,s.join("\n"),D(t.shape),i.getUserCode(),z(o,i)].join("\n")}let u="struct Uniforms { NAN : f32, INFINITY : f32, ";i.variableNames.forEach((t,i)=>{let r=R(e[i].shape.length);u+=`${t.charAt(0).toLowerCase()+t.slice(1)}Shape : ${r}, `,a=R(e[i].shape.length-1),u+=`${t.charAt(0).toLowerCase()+t.slice(1)}ShapeStrides: ${a}, `});let l=R(t.shape.length);u+=`outShape : ${l}, `,a=R(t.shape.length-1),u+=`
         outShapeStrides: ${a}, `,i.size&&(u+="size : i32, "),i.uniforms&&(u+=i.uniforms),u+="};",u=(r=u.replace(/(\w+)\s*:\s*vec(5|6)/g,e=>"@align(16) "+e)).replace(/vec(5|6)\s*,\s*(\w+)/g,(e,t,i)=>`vec${t}, @align(16) ${i}`),s.push(u),i.atomic?s.push(`
      @group(0) @binding(0) var<storage, read_write> result: array<atomic<i32>>;
    `):s.push(`
      @group(0) @binding(0) var<storage, read_write> result: array<${F(t.dtype,i.outputComponent)}>;
    `),i.variableNames.forEach((t,r)=>{s.push(`
      @group(0) @binding(${1+r}) var<storage, read> ${t}: array<${i.variableComponents?F(e[r].dtype,i.variableComponents[r]):F(e[r].dtype,i.outputComponent)}>;
        `)}),""!==u&&s.push(`
      @group(0) @binding(${1+i.variableNames.length}) var<uniform> uniforms: Uniforms;
      `);let d=function(e,t){let{x:i,y:r=[],z:a=[]}=t,s=e.length,o=i.length+r.length+a.length;if(o!==s)return"";if(i.length===s){let e=R(s);return`fn getOutputCoords() -> ${e}{
    let globalIndex = getGlobalIndex();
    return getCoordsFromIndex(globalIndex);
  }
  `}let n="",u=[i,r,a];for(let e=0;e<u.length;e++){let t=u[e];if(0!==t.length)if(1===t.length)n+=`let d${t[0]} = i32(globalId[${e}]);`;else{let i=function(e,t){if(Math.max(...e)>5)throw Error("Cannot symbolically compute strides for rank > 6 tensor.");let i=e.length,r=e.map(e=>`${t}.${"xyzwuv"[e]}`),a=Array(i-1);a[i-2]=r[i-1];for(let e=i-3;e>=0;--e)a[e]=`(${a[e+1]} * ${r[e+1]})`;return a}(t,"uniforms.outShape");n+=`var index${e} = i32(globalId[${e}]);`;for(let r=0;r<i.length;r++)n+=`let d${t[r]} = index${e} / ${i[r]};`,r===i.length-1?n+=`let d${t[r+1]} = index${e} - d${t[r]} * ${i[r]};`:n+=`index${e} = index${e} - d${t[r]} * ${i[r]};`}}let l=[];for(let e=0;e<o;e++)l.push(`d${e}`);let d=R(o),h=`fn getOutputCoords() -> ${d} {
  ${n}
`;return 0===l.length?h+=`return ${d}(0); }`:h+=`return ${d}(${l.join(",")}); }`,h}(t.shape,i.dispatchLayout),h=[A,s.join("\n")+N,D(t.shape),d,function(e){let t="";switch(e){case 0:case 1:t+=`
        fn getOutputIndexFromCoords(coords : i32) -> i32 {
          return coords;
        }
        `;break;case 2:t+=`
        fn getOutputIndexFromCoords(coords : vec2<i32>) -> i32 {
          return dot(coords, vec2<i32>(uniforms.outShapeStrides, 1));
        }
        `;break;case 3:t+=`
        fn getOutputIndexFromCoords(coords : vec3<i32>) -> i32 {
          return dot(coords, vec3<i32>(uniforms.outShapeStrides.x, uniforms.outShapeStrides.y, 1));
        }
        `;break;case 4:t+=`
        fn getOutputIndexFromCoords(coords : vec4<i32>) -> i32 {
          return dot(coords, vec4<i32>(
            uniforms.outShapeStrides.x, uniforms.outShapeStrides.y, uniforms.outShapeStrides.z, 1));
        }
        `;break;case 5:t+=`
        fn getOutputIndexFromCoords(coords : vec5) -> i32 {
          return coords.x * uniforms.outShapeStrides.x +
              coords.y * uniforms.outShapeStrides.y +
              coords.z * uniforms.outShapeStrides.z +
              coords.w * uniforms.outShapeStrides.w +
              coords.u;
        }
        `;break;case 6:t+=`
        fn getOutputIndexFromCoords(coords : vec6) -> i32 {
          return coords.x * uniforms.outShapeStrides.x +
              coords.y * uniforms.outShapeStrides.y +
              coords.z * uniforms.outShapeStrides.z +
              coords.w * uniforms.outShapeStrides.w +
              coords.u * uniforms.outShapeStrides.u +
              coords.v;
        }
        `;break;default:y.util.assert(!1,()=>`Unsupported ${e}D shape`)}return t}(t.shape.length)];i.atomic||h.push(function(e,t,i){let r=e.length,a=F(t,i),s=`fn setOutputAtIndex(flatIndex : i32, value : ${k(i)}) {
      result[flatIndex] = ${a}(value);
    }

    fn setOutputAtIndexI32(flatIndex : i32, value : ${k(i,"i32")}) {
      result[flatIndex] = ${a}(value);
    }
    `;if(r>=2){let e=["d0","d1","d2","d3","d4","d5"].slice(0,r),t=R(r);s+=`
      fn setOutputAtCoords(${e.map(e=>`${e} : i32`).join(", ")}, value : ${k(i)}) {
        let flatIndex = getOutputIndexFromCoords(${t}(${e.join(", ")}));
        setOutputAtIndex(flatIndex${1===i?"":` / ${i}`}, value);
      }
      fn setOutputAtCoordsI32(${e.map(e=>`${e} : i32`).join(", ")}, value : ${k(i,"i32")}) {
        let flatIndex = getOutputIndexFromCoords(${t}(${e.join(", ")}));
        setOutputAtIndexI32(flatIndex${1===i?"":` / ${i}`}, value);
      }
    `}return s}(t.shape,t.dtype,i.outputComponent)),i.variableNames.forEach((t,i)=>{h.push(`${D(e[i].shape,t)}`)});let p=e.map((e,r)=>{var a,s,o,n;let u;return a=e,s=t.shape,o=i.variableComponents?i.variableComponents[r]:i.outputComponent,n=i.dispatchLayout.x.length===t.shape.length,u=function(e,t){let i=e.name,r=e.shape.length,a=R(r),s="get"+i.charAt(0).toUpperCase()+i.slice(1),o=["d0","d1","d2","d3","d4","d5"].slice(0,r),n=o.map(e=>`${e} : i32`).join(", ");if(r<1)return`
      fn ${s}() -> ${k(t)} {
        return ${k(t)}(${i}[0]);
      }
    `;let u=`uniforms.${i.charAt(0).toLowerCase()+i.slice(1)}Shape`,l=`${r}D`;return 0===r&&(l="1D"),`
    fn ${s}(${n}) -> ${k(t)} {
      return ${k(t)}(${i}[getIndexFromCoords${l}(${a}(${o.join(",")}),
        ${u})${1===t?"":` / ${t}`}]);
    }
   `}(a,o),a.shape.length<=s.length&&(u+=function(e,t,i,r){let a=e.name,s=a.charAt(0).toUpperCase()+a.slice(1),o="get"+s+"ByOutput",n=e.shape.length,u=t.length,l=R(u);if(y.util.arraysEqual(e.shape,t)&&r)return`
    fn ${o}Index(globalIndex : i32) -> ${k(i)} {
      return ${k(i)}(${a}[globalIndex]);
    }

    fn ${o}Coords(coords : ${l}) -> ${k(i)} {
      return ${k(i)}(${a}[${u>1?"getOutputIndexFromCoords(coords)":"coords"}${1===i?"":` / ${i}`}]);
    }
    `;let d=m.backend_util.getBroadcastDims(e.shape,t),h=u-n,p="";if(0===n)return`
    fn ${o}Index(globalIndex : i32) -> ${k(i)}{
      return get${s}();
    }

    fn ${o}Coords(coords : ${l}) -> ${k(i)}{
      return get${s}();
    }
  `;p=u<2&&d.length>=1?"coords = 0;":d.map(e=>`coords.${$(e+h)} = 0;`).join("\n");let c="";if(u<2&&n>0)c="coords";else if(u>1){let t=R(n),i=e.shape.map((e,t)=>`coords.${$(t+h)}`).join(", ");c=`${t}(${i})`}else c="coords";let f=`uniforms.${a.charAt(0).toLowerCase()+a.slice(1)}Shape`,g=`${n}D`;return`
  fn ${o}Index(globalIndex : i32) -> ${k(i)} {
    var coords = getCoordsFromIndex(globalIndex);
    ${p}
    return ${k(i)}(${a}[getIndexFromCoords${g}(${c}, ${f})${1===i?"":` / ${i}`}]);
  }

  fn ${o}Coords(coordsIn : ${l}) -> ${k(i)} {
    var coords = coordsIn;
    ${p}
    return ${k(i)}(${a}[getIndexFromCoords${g}(${c}, ${f})${1===i?"":` / ${i}`}]);
  }
`}(a,s,o,n)),u}).join("\n");h.push(p),h.push(i.getUserCode());let c=_(i);return h.push(z(c,i)),h.join("\n")}(i,{dtype:r.dtype,shape:r.shape},t),o=e.createShaderModule({code:s,label:t.constructor.name}),u=(0,p.env)().get("WEBGPU_PRINT_SHADER");if(""!==u){let e=(u=u.toLowerCase()).split(",");("all"===u||e.some(e=>t.shaderKey.toLowerCase().includes(e)))&&(console.group(t.shaderKey),console.debug(s),console.groupEnd())}return a?e.createComputePipelineAsync({compute:{module:o,entryPoint:"_start"},label:t.constructor.name,layout:"auto"}):e.createComputePipeline({compute:{module:o,entryPoint:"_start"},label:t.constructor.name,layout:"auto"})})(this.device,e,s,a,o)),e.pipeline=this.pipelineCache[e.shaderKey],o||this.recordAndSubmit(e,a,t,r),a}recordAndSubmit(e,t,i,r){if(e.pipeline instanceof Promise)throw Error("Please call checkCompileCompletionAsync to ensure parallel compilation is done!");let a=[],s=[],o="int32";if(null==e.pixelsOpType){a.push({type:"float32",data:[NaN]},{type:"float32",data:[1/0]});let e="int32";(s=i.concat(t).map(e=>e.shape)).map(t=>{a.push({type:e,data:t});let i=y.util.computeStrides(t);a.push({type:e,data:i})})}else{let e=y.util.computeStrides(t.shape);a.push({type:o,data:e})}if(e.size){let t=y.util.sizeFromShape(e.outputShape);a.push({type:o,data:[e.outputComponent?t/e.outputComponent:t]})}r&&(a=[...a,...r]);let u=[this.tensorToBinding(t),...i.map(e=>this.tensorToBinding(e)),this.makeUniforms(a)];i.forEach(e=>{this.commandQueueOwnedIds.add(e.dataId)}),this.commandQueueOwnedIds.add(t.dataId);let l=this.device.createBindGroup({layout:e.pipeline.getBindGroupLayout(0),entries:u.map((e,t)=>({binding:t,resource:e}))}),d=null!=this.activeTimers;this.ensureCommandEncoderReady();let h={};d&&this.supportTimestampQuery?(this.endComputePassEncoder(),null==this.querySet&&(this.querySet=this.device.createQuerySet({type:"timestamp",count:this.querySetCount})),h.timestampWrites={querySet:this.querySet,beginningOfPassWriteIndex:0,endOfPassWriteIndex:1},this.computePassEncoder=this.commandEncoder.beginComputePass(h)):this.computePassEncoder||(this.computePassEncoder=this.commandEncoder.beginComputePass(h)),this.computePassEncoder.setPipeline(e.pipeline),this.computePassEncoder.setBindGroup(0,l),this.computePassEncoder.dispatchWorkgroups(e.dispatch[0],e.dispatch[1],e.dispatch[2]),this.dispatchCountInPass++,(d||(0,p.env)().get("WEBGPU_DEFERRED_SUBMIT_BATCH_SIZE")<=this.dispatchCountInPass||e.pixelsOpType===n.DRAW)&&(this.endComputePassEncoder(),d?this.activeTimers.push({name:e.constructor.name,query:this.getQueryTime()}):this.submitQueue())}async getQueryTime(){if(!this.supportTimestampQuery)return 0;null==this.queryResolveBuffer&&(this.queryResolveBuffer=this.bufferManager.acquireBuffer(8*this.querySetCount,GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST|GPUBufferUsage.QUERY_RESOLVE)),this.commandEncoder.resolveQuerySet(this.querySet,0,this.querySetCount,this.queryResolveBuffer,0);let e=this.bufferManager.acquireBuffer(8*this.querySetCount,GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST);this.commandEncoder.copyBufferToBuffer(this.queryResolveBuffer,0,e,0,8*this.querySetCount),this.submitQueue(),await e.mapAsync(GPUMapMode.READ);let t=new BigUint64Array(e.getMappedRange()),i=Number(t[1]-t[0])/1e6;return e.unmap(),this.bufferManager.releaseBuffer(e),i}shouldExecuteOnCPU(e,t=H){return(0,p.env)().getBool("WEBGPU_CPU_FORWARD")&&e.every(e=>null==this.tensorMap.get(e.dataId).resource&&y.util.sizeFromShape(e.shape)<t)}numDataIds(){return this.tensorMap.numDataIds()-this.tensorDataPendingDisposal.length}dispose(){this.disposed||(null!=this.querySet&&this.querySet.destroy(),this.bufferManager.dispose(),this.textureManager.dispose(),this.disposed=!0)}}X.nextDataId=0;var K=e.i(889135);e.s([],833210),V()&&(0,f.registerBackend)("webgpu",async()=>{let e={powerPreference:(0,p.env)().get("WEBGPU_USE_LOW_POWER_GPU")?"low-power":"high-performance"},t=await navigator.gpu.requestAdapter(e),i={},r=[];t.features.has("timestamp-query")&&r.push("timestamp-query"),t.features.has("bgra8unorm-storage")&&r.push(["bgra8unorm-storage"]),i.requiredFeatures=r;let a=t.limits;return i.requiredLimits={maxComputeWorkgroupStorageSize:a.maxComputeWorkgroupStorageSize,maxComputeWorkgroupsPerDimension:a.maxComputeWorkgroupsPerDimension,maxStorageBufferBindingSize:a.maxStorageBufferBindingSize,maxBufferSize:a.maxBufferSize,maxComputeWorkgroupSizeX:a.maxComputeWorkgroupSizeX,maxComputeInvocationsPerWorkgroup:a.maxComputeInvocationsPerWorkgroup},new X(await t.requestDevice(i),"info"in t?t.info:"requestAdapterInfo"in t?await t.requestAdapterInfo():void 0)},3),e.s([],86946);var q=e.i(311541),Y=e.i(998529),j=e.i(298692);(a=l||(l={}))[a.ADD=0]="ADD",a[a.ATAN2=1]="ATAN2",a[a.COMPLEX_MULTIPLY_IMAG=2]="COMPLEX_MULTIPLY_IMAG",a[a.COMPLEX_MULTIPLY_REAL=3]="COMPLEX_MULTIPLY_REAL",a[a.DIV=4]="DIV",a[a.ELU_DER=5]="ELU_DER",a[a.EQUAL=6]="EQUAL",a[a.FLOOR_DIV=7]="FLOOR_DIV",a[a.GREATER=8]="GREATER",a[a.GREATER_EQUAL=9]="GREATER_EQUAL",a[a.LESS=10]="LESS",a[a.LESS_EQUAL=11]="LESS_EQUAL",a[a.LOGICAL_AND=12]="LOGICAL_AND",a[a.LOGICAL_OR=13]="LOGICAL_OR",a[a.MAX=14]="MAX",a[a.MIN=15]="MIN",a[a.MOD=16]="MOD",a[a.MUL=17]="MUL",a[a.NOT_EQUAL=18]="NOT_EQUAL",a[a.POW=19]="POW",a[a.PRELU=20]="PRELU",a[a.SQUARED_DIFFERENCE=21]="SQUARED_DIFFERENCE",a[a.SUB=22]="SUB";let Q=`
  let zero = sign(a) * 0 + 0;
  let one = sign(b) * 0 + 1;
  let resultTemp = select(zero, one, a == b);
`,Z=`
  let remainder =
      select(a % b, round(a % b), (round(a) == a) & (round(b) == b));
  let quotient = (a - remainder) / b;
  let resultTemp =
      round(select(quotient, quotient - 1, sign(remainder) == -sign(b)));
`,J=`
  let zero = sign(a) * 0 + 0;
  let one = sign(b) * 0 + 1;
  let resultTemp = select(zero, one, a > b);
`,ee=`
  let zero = sign(a) * 0 + 0;
  let one = sign(b) * 0 + 1;
  let resultTemp = select(zero, one, a >= b);
`,et=`
  let zero = sign(a) * 0 + 0;
  let one = sign(b) * 0 + 1;
  let resultTemp = select(zero, one, a < b);
`,ei=`
  let zero = sign(a) * 0 + 0;
  let one = sign(b) * 0 + 1;
  let resultTemp = select(zero, one, a <= b);
`,er=`return (vec4<f32>(a >= vec4<f32>(1.0)) *
  vec4<f32>(b >= vec4<f32>(1.0)));`,ea=`return min(vec4<f32>(a >= vec4<f32>(1.0)) +
  vec4<f32>(b >= vec4<f32>(1.0)), vec4<f32>(1.0));`,es=`
  let isNaN = b == 0.;
  var resultTemp = a % b;
  resultTemp = select((resultTemp + b) % b, resultTemp,
      (a < 0. && b < 0.) || (a >= 0. && b > 0.));
`,eo=`
  let isNaN = !vec4<bool>(b);
  var resultTemp = vec4<f32>(a % b);
  if (!((a[0] < 0. && b[0] < 0.) || (a[0] >= 0. && b[0] > 0.))) {
    resultTemp[0] = (resultTemp[0] + b[0]) % b[0];
  }
  if (!((a[1] < 0. && b[1] < 0.) || (a[1] >= 0. && b[1] > 0.))) {
    resultTemp[1] = (resultTemp[1] + b[1]) % b[1];
  }
  if (!((a[2] < 0. && b[2] < 0.) || (a[2] >= 0. && b[2] > 0.))) {
    resultTemp[2] = (resultTemp[2] + b[2]) % b[2];
  }
  if (!((a[3] < 0. && b[3] < 0.) || (a[3] >= 0. && b[3] > 0.))) {
    resultTemp[3] = (resultTemp[3] + b[3]) % b[3];
  }
`,en=`
  var resultTemp = f32(a != b);
  let valueForNaN = 1.0;
`,eu=`
  var resultTemp = vec4<f32>(a != b);
  let valueForNaN = 1.0;
`,el=`
  let isNaN = a < 0.0 && floor(b) < b;
  if (b == 0.0) {
    return 1.0;
  }
  var resultTemp = select(sign(a) * pow(abs(a), b), pow(abs(a), b),
      round(abs(b) % 2.0) != 1.0);
`,ed=`
  let isModRound1Bool = vec4<i32>(round(abs(b) % vec4<f32>(2.0))) == vec4<i32>(1);
  let isModRound1 = vec4<f32>(isModRound1Bool);
  let multiplier = sign(a) * isModRound1 + (vec4<f32>(1.0) - isModRound1);
  var resultTemp = multiplier * pow(abs(a), b);

  // Ensure that a^0 = 1, including 0^0 = 1 as this correspond to TF and JS
  let isExpZero = b == vec4<f32>(0.0);
  if (isExpZero.r) {
    resultTemp.r = 1.0;
  }
  if (isExpZero.g) {
    resultTemp.g = 1.0;
  }
  if (isExpZero.b) {
    resultTemp.b = 1.0;
  }
  if (isExpZero.a) {
    resultTemp.a = 1.0;
  }
  let isNaN = (a < vec4<f32>(0.0)) & (floor(b) < b);
`,eh=`
  let aLessThanZero = vec4<f32>(a < vec4<f32>(0.0));
  return (aLessThanZero * (b * a)) + ((vec4<f32>(1.0) - aLessThanZero) * a);
`;function ep(e,t){let i;do{let r,a,s;switch(e){case l.ATAN2:i="let resultTemp = atan2(a, b);";break;case l.MAX:i="let resultTemp = max(a, b);";break;case l.MIN:i="let resultTemp = min(a, b);";break;case l.MOD:i=t?eo:es;break;case l.NOT_EQUAL:i=t?eu:en;break;case l.POW:i=t?ed:el;break;default:continue}return t?(r="isnanVec4",a="vec4<f32>",s="vec4<bool>"):(r="isnan",a="f32",s="bool"),`
      let aIsNaN = ${r}(a);
      let aPostLegalization = select(a, ${a}(42), aIsNaN);
      let bIsNaN = ${r}(b);
      let bPostLegalization = select(b, ${a}(42), bIsNaN);
      let isNaN = false;
      let valueForNaN = uniforms.NAN;
      {
        let a = aPostLegalization;
        let b = bPostLegalization;
        ${i}
        return select(
            resultTemp, ${a}(valueForNaN),
            ${s}(isNaN) | aIsNaN | bIsNaN);
      }
    `}while(!1)switch(e){case l.ADD:i="let resultTemp = a + b;";break;case l.COMPLEX_MULTIPLY_IMAG:i="let resultTemp = areal * bimag + aimag * breal;";break;case l.COMPLEX_MULTIPLY_REAL:i="let resultTemp = areal * breal - aimag * bimag;";break;case l.DIV:i="let resultTemp = a / b;";break;case l.ELU_DER:i="let resultTemp = select(a * (b + 1.0), a, b >= b - b);";break;case l.EQUAL:i=Q;break;case l.FLOOR_DIV:i=Z;break;case l.GREATER:i=J;break;case l.GREATER_EQUAL:i=ee;break;case l.LESS:i=et;break;case l.LESS_EQUAL:i=ei;break;case l.LOGICAL_AND:return t?er:"return f32(a >= 1.0 && b >= 1.0);";case l.LOGICAL_OR:return t?ea:"return f32(a >= 1.0 || b >= 1.0);";case l.MUL:i="let resultTemp = a * b;";break;case l.PRELU:return t?eh:"if (a < 0.0) { return b * a; }  return a;";case l.SQUARED_DIFFERENCE:i="let resultTemp = (a - b) * (a - b);";break;case l.SUB:i="let resultTemp = a - b;"}return`
    ${i}
    return resultTemp;
  `}(s=d||(d={}))[s.ABS=0]="ABS",s[s.ACOS=1]="ACOS",s[s.ACOSH=2]="ACOSH",s[s.ASIN=3]="ASIN",s[s.ASINH=4]="ASINH",s[s.ATAN=5]="ATAN",s[s.ATANH=6]="ATANH",s[s.CEIL=7]="CEIL",s[s.COS=8]="COS",s[s.COSH=9]="COSH",s[s.ELU=10]="ELU",s[s.ERF=11]="ERF",s[s.EXP=12]="EXP",s[s.EXPM1=13]="EXPM1",s[s.FLOOR=14]="FLOOR",s[s.IS_FINITE=15]="IS_FINITE",s[s.IS_INF=16]="IS_INF",s[s.IS_NAN=17]="IS_NAN",s[s.LINEAR=18]="LINEAR",s[s.LOG=19]="LOG",s[s.LOG1P=20]="LOG1P",s[s.LOGICAL_NOT=21]="LOGICAL_NOT",s[s.NEG=22]="NEG",s[s.RELU=23]="RELU",s[s.RELU6=24]="RELU6",s[s.LEAKYRELU=25]="LEAKYRELU",s[s.RECIPROCAL=26]="RECIPROCAL",s[s.ROUND=27]="ROUND",s[s.RSQRT=28]="RSQRT",s[s.SELU=29]="SELU",s[s.SIGMOID=30]="SIGMOID",s[s.SIGN=31]="SIGN",s[s.SIN=32]="SIN",s[s.SINH=33]="SINH",s[s.SOFTPLUS=34]="SOFTPLUS",s[s.SQRT=35]="SQRT",s[s.SQUARE=36]="SQUARE",s[s.STEP=37]="STEP",s[s.TAN=38]="TAN",s[s.TANH=39]="TANH",s[s.TO_INT=40]="TO_INT";let ec=`
  if (abs(a) > 1.) {
    return uniforms.NAN;
  }
  return acos(a);
`,ef=`
  if (a < 1.) {
    return uniforms.NAN;
  }
  return acosh(a);
`,em=`
  if (abs(a) > 1.) {
    return uniforms.NAN;
  }
  return asin(a);
`,eg=`
  if (isnan(a)) {
    return uniforms.NAN;
  }
  return atan(a);
`,ex=`
  if (abs(a) > 1.) {
    return uniforms.NAN;
  }
  if (a == 1.) {
    return uniforms.INFINITY;
  }
  if (a == -1.) {
    return -uniforms.INFINITY;
  }
  return atanh(a);
`,ey=`
  let e2x = exp(-a);
  return (e2x + 1.0 / e2x) / 2.0;
`,ew=`
  var resFloat = exp(a) - vec4<f32>(1.0);
  if (a.r >= 0.0) {
    resFloat.r = a.r;
  }
  if (a.g >= 0.0) {
    resFloat.g = a.g;
  }
  if (a.b >= 0.0) {
    resFloat.b = a.b;
  }
  if (a.a >= 0.0) {
    resFloat.a = a.a;
  }
  return resFloat;
`,eb=`
  // Error function is calculated approximately with elementary function.
  // See "Handbook of Mathematical Functions with Formulas,
  // Graphs, and Mathematical Tables", Abramowitz and Stegun.
  let p = ${m.backend_util.ERF_P};
  let a1 = ${m.backend_util.ERF_A1};
  let a2 = ${m.backend_util.ERF_A2};
  let a3 = ${m.backend_util.ERF_A3};
  let a4 = ${m.backend_util.ERF_A4};
  let a5 = ${m.backend_util.ERF_A5};

  let sign = sign(a);
  let absA = abs(a);
  let t = 1.0 / (1.0 + p * absA);
  return sign * (1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * exp(-absA * absA));
`,eC=`if (a < 0.0) { return uniforms.NAN; }
  return log(a);`,eS=`
  if (isnan(a)) { return a; }
  return log(1.0 + a);
`,ev=`
  let aLessThanZero = vec4<f32>(a < vec4<f32>(0.0));
  return (aLessThanZero * (uniforms.alpha * a)) + ((vec4<f32>(1.0) - aLessThanZero) * a);
`,eI=`
  return select(a, vec4<f32>(0.0), a < vec4<f32>(0.0));
`,ek=`
  if (a >= 0.0) {
    return ${m.backend_util.SELU_SCALE} * a;
  } else {
    return ${m.backend_util.SELU_SCALEALPHA} * (exp(a) - 1.0);
  }
`,eR=`
  let e2x = exp(a);
  return (e2x - 1.0 / e2x) / 2.0;
`,e$=`
  let epsilon = 1.1920928955078125e-7;
  let threshold = log(epsilon) + 2.0;

  let too_large = a > -threshold;
  let too_small = a < threshold;
  let exp_a = exp(a);

  if (too_large) {
    return a;
  } else if (too_small) {
    return exp_a;
  } else {
    return log(exp_a + 1.0);
  }
`,eP=`
  if (isnan(a)) {
    return a;
  }

  return select(uniforms.stepAlpha, 1.0, a > 0.0);
`,ez=`
  let e2x = exp(-2.0 * abs(a));
  return sign(a) * (1.0 - e2x) / (1.0 + e2x);
`;function eA(e,t){switch(e){case d.ABS:return"return abs(a);";case d.ACOS:return ec;case d.ACOSH:return ef;case d.ASIN:return em;case d.ASINH:return"return asinh(a);";case d.ATAN:return eg;case d.ATANH:return ex;case d.COS:return"return cos(a);";case d.COSH:return ey;case d.CEIL:return"return ceil(a);";case d.ELU:return t?ew:"if (a >= 0.0) { return a; }  return (exp(a) - 1.0);";case d.ERF:return eb;case d.EXP:return"return exp(a);";case d.EXPM1:return"return exp(a) - 1.0;";case d.FLOOR:return"return floor(a);";case d.IS_FINITE:return"return f32(!isnan(a) && !isinf(a));";case d.IS_INF:return"return f32(isinf(a));";case d.IS_NAN:return"return f32(isnan(a));";case d.LINEAR:return"return a;";case d.LOG:return eC;case d.LOG1P:return eS;case d.LOGICAL_NOT:return"return f32(!(a >= 1.0));";case d.NEG:return"return -a;";case d.LEAKYRELU:return t?ev:"if (a < 0.0) { return uniforms.alpha * a; } return a;";case d.RECIPROCAL:return"return 1.0 / a;";case d.RELU:return t?eI:"return select(a, 0.0, a < 0.0);";case d.RELU6:return t?"return clamp(a, vec4<f32>(0.0, 0.0, 0.0, 0.0), vec4<f32>(6.0, 6.0, 6.0, 6.0));":"return clamp(a, 0.0, 6.0);";case d.ROUND:return"return round(a);";case d.RSQRT:return"return inverseSqrt(a);";case d.SELU:return ek;case d.SIGMOID:return"return 1.0 / (1.0 + exp(-1.0 * a));";case d.SIGN:return"return sign(a);";case d.SIN:return"return sin(a);";case d.SINH:return eR;case d.SOFTPLUS:return e$;case d.SQRT:return"return sqrt(a);";case d.SQUARE:return"return a * a;";case d.STEP:return eP;case d.TAN:return"return tan(a);";case d.TANH:return ez;case d.TO_INT:return"return f32(i32((a)));";default:throw Error(`BinaryType ${e} is not implemented!`)}}function eN(e,t=!1,i=!1,r=3){if(null===e)return"";let a="";if("linear"===e)a=eA(d.LINEAR);else if("relu"===e)a=eA(d.RELU,i);else if("elu"===e)a=eA(d.ELU,i);else if("relu6"===e)a=eA(d.RELU6,i);else if("prelu"===e)a=ep(l.PRELU,i);else if("sigmoid"===e)a=eA(d.SIGMOID,i);else if("leakyrelu"===e)a=eA(d.LEAKYRELU,i);else throw Error(`Activation ${e} has not been implemented for the WebGPU backend.`);let s=k(i?4:1);return t?`
      fn activation(a : ${s}, coords : vec${r}<i32>) -> ${s} {
        let b = getPreluActivationWeightsByOutputCoords(coords);
        ${a}
      }`:`
      fn activation(a : ${s}, coords : vec${r}<i32>) -> ${s} {
        ${a}
      }`}function eD(e,t){return`
      ${e?"value = value + getBiasByOutputCoords(coords);":""}
      ${t?"value = activation(value, coords);":""}
      `}function eT(e,t,i=!1,r=!1,a=!1,s=1){y.util.assert(e&&1===s||!e,()=>`transposeA ${e} is not compatible with component size ${s}`);let o=`
      ${e?"value = getA(batch, col, row);":"value = getA(batch, row, col);"}

    `;return`
  fn mm_readA(batch: i32, row: i32, col: i32) -> ${k(s)} {
    var value = ${k(s)}(0.0);
    ${i&&a?o:`
    ${e?"if(row < uniforms.dimAOuter && col < uniforms.dimInner)":"if(row < uniforms.aShape[1] && col < uniforms.aShape[2])"}
    {
      ${o}
    }
    `}
    return value;
  }

  fn mm_readB(batch: i32, row: i32, col: i32) -> ${k(s)} {
    var value = ${k(s)}(0.0);
    ${t?"value = getB(batch, col, row);":"value = getB(batch, row, col);"}
    return value;
  }
  `}function eF(e,t,i,r,a=!1,s=!1,o=!1,n=1){return`
  ${eT(i,r,a,s,o,n)}
  fn mm_write(batch: i32, row: i32, col: i32, valueIn: ${k(n)}) {
    ${a&&s?"":"if (row < uniforms.dimAOuter && col < uniforms.dimBOuter)"}
    {
      var value = valueIn;
      let coords = vec3<i32>(batch, row, col);
      ${eD(e,t)}
      setOutputAtCoords(coords[0], coords[1], coords[2], value);
    }
  }
  `}function e_(e,t,i=!1,r=32,a=!1,s=32,o=!1){let n=t[1]*e[1],u=t[0]*e[0],l=i?n:r,d=i?r:n,h=l/t[0],p=r/t[1],c=e[1],f=e[0];return y.util.assert((i&&4===h&&4===e[1]||!i&&(3===h||4===h))&&l%t[0]==0&&r%t[1]==0&&4===e[0],()=>`If transposeA ${i} is true, innerElementSize ${h} and workPerThread[1] ${e[1]} must be 4.
          Otherwise, innerElementSize ${h} must be 3 or 4.
      tileAWidth ${l} must be divisible by workgroupSize[0]${t[0]}. tileInner ${r} must be divisible by workgroupSize[1] ${t[1]}. colPerThread ${e[0]} must be 4.`),`
  var<workgroup> mm_Asub : array<array<vec${h}<f32>, ${l/h}>, ${d}>;
  var<workgroup> mm_Bsub : array<array<vec4<f32>, ${u/e[0]}>, ${r}>;

  ${P()} {
    let localRow = i32(localId.y);
    let tileRow = localRow * ${c};
    let tileCol = i32(localId.x);

    let globalRow = i32(globalId.y) * ${c};
    let globalCol = i32(globalId.x) * ${f};
    let batch = ${a?"0":"i32(globalId.z)"};
    let batchA = ${a||!o?"batch":"batch % uniforms.aShape[0]"};
    let batchB = ${a||!o?"batch":"batch % uniforms.bShape[0]"};
    let globalRowStart = i32(workgroupId.y) * ${n};

    let numTiles = ${a?`${Math.ceil(s/r)}`:`(uniforms.dimInner - 1) / ${r} + 1`};
    var kStart = ${a?`i32(globalId.z) * ${s}`:"0"};

    var acc: array<vec4<f32>, ${c}>;

    // Loop over shared dimension.
    let tileRowB = localRow * ${p};
    for (var t = 0; t < numTiles; t++) {
        // Load one tile of A into local memory.
        for (var innerRow = 0; innerRow < ${c}; innerRow++) {
            let inputRow = tileRow + innerRow;
            let inputCol = tileCol;
            ${i?`
        mm_Asub[inputRow][inputCol] = mm_readA(batchA,
          kStart + inputRow,
          globalRowStart + inputCol * ${h});
        `:`
        mm_Asub[inputRow][inputCol] = mm_readA(batchA,
          globalRow + innerRow,
          kStart + inputCol * ${h});
        `}
        }

        // Load one tile of B into local memory.
        for (var innerRow = 0; innerRow < ${p}; innerRow++) {
            let inputRow = tileRowB + innerRow;
            let inputCol = tileCol;
            mm_Bsub[inputRow][inputCol] = mm_readB(batchB, kStart + inputRow, globalCol);
        }
        kStart = kStart + ${r};
        workgroupBarrier();

        // Compute acc values for a single thread.
        ${((e,t,i,r)=>{if(e)return`
      for (var k = 0; k < ${r}; k++) {
        let BCached0 = mm_Bsub[k][tileCol];
        let ACached0 = mm_Asub[k][localRow];
        for (var i = 0; i < ${i}; i++) {
          acc[i] = fma(BCached0, vec4<f32>(ACached0[i]), acc[i]);
        }
      }`;{let e="",a="";for(let i=0;i<t;i++)e+=`let BCached${i} = mm_Bsub[k * ${t} + ${i}][tileCol];`,a+=`acc[i] = fma(BCached${i}, vec4<f32>(ACached[${i}]), acc[i]);`;return`
      for (var k = 0; k < ${r/t}; k++) {
        ${e}
        for (var i = 0; i < ${i}; i++) {
          let ACached = mm_Asub[tileRow + i][k];
          ${a}
        }
      }`}})(i,h,c,r)}
        workgroupBarrier();
    }

    for (var innerRow = 0; innerRow < ${c}; innerRow++) {
        mm_write(batch, globalRow + innerRow, globalCol, acc[innerRow]);
    }
  }`}let eE=e=>e?`
        mm_Asub[inputRow][inputCol] = mm_readA(batchA,
          kStart + inputRow,
          globalRowStart + inputCol);
        `:`
        mm_Asub[inputRow][inputCol] = mm_readA(batchA,
          globalRowStart + inputRow,
          kStart + inputCol);
        `;function eL(e,t,i=!1,r=32,a=!1,s=32,o=!1,n=!1){let u=e[1]*t[1],l=e[0]*t[0],d=i?u:r,h=i?r:u;y.util.assert(h%t[1]==0&&d%t[0]==0&&r%t[1]==0,()=>`tileAHight ${h} must be divisible by workgroupSize[1]${t[1]}, tileAWidth ${d} must be divisible by workgroupSize[0]${t[0]}, tileInner ${r} must be divisible by workgroupSize[1]${t[1]}`);let p=h/t[1],c=d/t[0],f=r/t[1],m=e[1],g=e[0],x=o?`
      let localRow = i32(localId.y);
      let localCol = i32(localId.x);
      let globalRowStart = i32(workgroupId.y) * ${u};
      let globalColStart = i32(workgroupId.x) * ${l};

      // Loop over shared dimension.
      for (var t = 0; t < numTiles; t++) {
        // Load one tile of A into local memory.
        for (var inputRow = localRow; inputRow < ${h}; inputRow = inputRow + ${t[1]}) {
          for (var inputCol = localCol; inputCol < ${d}; inputCol = inputCol + ${t[0]}) {
            ${eE(i)}
          }
        }
        // Load one tile of B into local memory.
        for (var inputRow = localRow; inputRow < ${r}; inputRow = inputRow + ${t[1]}) {
              for (var inputCol = localCol; inputCol < ${l}; inputCol = inputCol + ${t[0]}) {
            mm_Bsub[inputRow][inputCol] = mm_readB(batchB,
              kStart + inputRow,
              globalColStart + inputCol);
          }
        }
        kStart = kStart + ${r};
        workgroupBarrier();

        // Compute acc values for a single thread.
        var BCached : array<f32, ${g}>;
        for (var k = 0; k < ${r}; k++) {
          for (var inner = 0; inner < ${g}; inner++) {
            BCached[inner] = mm_Bsub[k][localCol + inner * ${t[0]}];
          }
          for (var innerRow = 0; innerRow < ${m}; innerRow++) {
            let ACached = ${i?`mm_Asub[k][localRow + innerRow * ${t[1]}];`:`mm_Asub[localRow + innerRow * ${t[1]}][k];`}
            for (var innerCol = 0; innerCol < ${g}; innerCol++) {
              acc[innerRow][innerCol] =
                  fma(ACached, BCached[innerCol], acc[innerRow][innerCol]);
            }
          }
        }
        workgroupBarrier();
      }
      for (var innerRow = 0; innerRow < ${m}; innerRow++) {
        let gRow = globalRowStart + localRow + innerRow * ${t[1]};
        for (var innerCol = 0; innerCol < ${g}; innerCol++) {
          let gCol = globalColStart + localCol + innerCol * ${t[0]};
          mm_write(batch, gRow, gCol, acc[innerRow][innerCol]);
        }
      }
      `:`
  let tileRow = i32(localId.y) * ${m};
  let tileCol = i32(localId.x) * ${g};

  let globalRow = i32(globalId.y) * ${m};
  let globalCol = i32(globalId.x) * ${g};
  let globalRowStart = i32(workgroupId.y) * ${u};

  let tileRowA = i32(localId.y) * ${p};
  let tileColA = i32(localId.x) * ${c};
  let tileRowB = i32(localId.y) * ${f};
  // Loop over shared dimension.
  for (var t = 0; t < numTiles; t++) {
    // Load one tile of A into local memory.
    for (var innerRow = 0; innerRow < ${p}; innerRow++) {
      for (var innerCol = 0; innerCol < ${c}; innerCol++) {
        let inputRow = tileRowA + innerRow;
        let inputCol = tileColA + innerCol;
        ${eE(i)}
      }
    }

    // Load one tile of B into local memory.
    for (var innerRow = 0; innerRow < ${f}; innerRow++) {
      for (var innerCol = 0; innerCol < ${g}; innerCol++) {
        let inputRow = tileRowB + innerRow;
        let inputCol = tileCol + innerCol;
        mm_Bsub[inputRow][inputCol] = mm_readB(batchB,
          kStart + inputRow,
          globalCol + innerCol);
      }
    }
    kStart = kStart + ${r};
    workgroupBarrier();

    // Compute acc values for a single thread.
    var BCached : array<f32, ${g}>;
    for (var k = 0; k < ${r}; k++) {
      for (var inner = 0; inner < ${g}; inner++) {
        BCached[inner] = mm_Bsub[k][tileCol + inner];
      }

      for (var innerRow = 0; innerRow < ${m}; innerRow++) {
        ${i?"let ACached = mm_Asub[k][tileRow + innerRow];":"let ACached = mm_Asub[tileRow + innerRow][k];"}
        for (var innerCol = 0; innerCol < ${g}; innerCol++) {
          acc[innerRow][innerCol] =
              fma(ACached, BCached[innerCol], acc[innerRow][innerCol]);
        }
      }
    }

    workgroupBarrier();
  }

  for (var innerRow = 0; innerRow < ${m}; innerRow++) {
    for (var innerCol = 0; innerCol < ${g}; innerCol++) {
      mm_write(batch, globalRow + innerRow, globalCol + innerCol,
          acc[innerRow][innerCol]);
    }
  }
  `;return`
    var<workgroup> mm_Asub : array<array<f32, ${d}>, ${h}>;
    var<workgroup> mm_Bsub : array<array<f32, ${l}>, ${r}>;

    ${P()} {
      let batch = ${a?"0":"i32(globalId.z)"};
      let batchA = ${a||!n?"batch":"batch % uniforms.aShape[0]"};
      let batchB = ${a||!n?"batch":"batch % uniforms.bShape[0]"};
      let numTiles = ${a?`${Math.ceil(s/r)}`:`(uniforms.dimInner - 1) / ${r} + 1`};
      var kStart = ${a?`i32(globalId.z) * ${s}`:"0"};

      var acc : array<array<f32, ${g}>, ${m}>;

      // Without this initialization strange values show up in acc.
      for (var innerRow = 0; innerRow < ${m}; innerRow++) {
        for (var innerCol = 0; innerCol < ${g}; innerCol++) {
          acc[innerRow][innerCol] = 0.0;
        }
      }
      ${x}
    }
  `}class eB{constructor(e,t,i=!1,r=!1,a=null,s=null,o=null,n=!1){this.variableNames=["A","B"],this.uniforms="dimAOuter : i32, dimBOuter : i32, dimInner : i32,",this.outputShape=t,this.dispatchLayout={x:[2],y:[1],z:[0]};const u=i?e[1]:e[2];if(this.isVec4=(u%4==0&&!i||t[1]%4==0&&i)&&t[2]%4==0&&!r,this.outputComponent=this.isVec4?4:1,this.isVectorA=1===t[1]&&!i,!this.isVec4&&this.isVectorA)this.elementsPerThread=[1,1,1],this.workgroupSize=[32,1,1];else{const e=B(t[1],u,t[2],i);this.workgroupSize=e.workgroupSize,this.elementsPerThread=e.elementsPerThread}this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize,this.elementsPerThread);const l=null!=a,d=null!=o;l&&this.variableNames.push("bias"),d&&this.variableNames.push("preluActivationWeights"),this.sequentialAccessByThreads=n,this.transposeA=i,this.transposeB=r,this.addBias=l,this.activation=s,this.hasPreluActivationWeights=d,[this.fitAOuter,this.fitBOuter,this.fitInner]=this.getShapeFit(t[1],t[2],u),this.shaderKey=`matMulPacked_${this.elementsPerThread}_${i}_${r}_${this.activation}_${this.fitAOuter}_${this.fitBOuter}_${this.fitInner}_${this.isVec4}_${this.isVectorA}_${this.sequentialAccessByThreads}`}getShapeFit(e,t,i){let r=this.workgroupSize[1]*this.elementsPerThread[1],a=this.workgroupSize[0]*this.elementsPerThread[0];return!this.isVec4&&this.isVectorA?this.tileInner=4*this.workgroupSize[0]:this.tileInner=a,[e%r==0,t%a==0,i%this.tileInner==0]}getUserCode(){return`
      ${eN(this.activation,this.hasPreluActivationWeights,this.isVec4)}
      ${eF(this.addBias,this.activation,!1,this.transposeB,this.fitAOuter,this.fitBOuter,this.fitInner,this.isVec4?4:1)}
      ${this.isVec4?e_(this.elementsPerThread,this.workgroupSize,this.transposeA,this.tileInner,!1,null,!0):this.isVectorA?function(e,t=!1){y.util.assert(1===e[1]&&1===e[2],()=>`A linear work group size is required. But got ${e}.`);let i=4*e[0];return`
    var<workgroup> mm_Asub : array<vec4<f32>, ${e[0]}>;

    ${P()} {
      let tileCol = i32(localId.x);
      let globalCol = i32(globalId.x);
      let globalRow = i32(globalId.y);

      let numTiles = (uniforms.dimInner - 1) / ${i} + 1;
      let batch = i32(globalId.z);
      let batchA = batch % uniforms.aShape[0];
      let batchB = batch % uniforms.bShape[0];
      // Without this initialization strange values show up in acc.
      var acc = 0.0;

      // Loop over shared dimension.
      for (var t = 0; t < numTiles; t++) {
        // Load one tile of A into local memory.
        let colA = t * ${i} + tileCol * 4;
        mm_Asub[tileCol] = vec4<f32>(${t?`
      mm_readA(batchA, colA, globalRow),
      mm_readA(batchA, colA + 1, globalRow),
      mm_readA(batchA, colA + 2, globalRow),
      mm_readA(batchA, colA + 3, globalRow)
  `:`
      mm_readA(batchA, globalRow, colA),
      mm_readA(batchA, globalRow, colA + 1),
      mm_readA(batchA, globalRow, colA + 2),
      mm_readA(batchA, globalRow, colA + 3)
  `});
        workgroupBarrier();

        // Compute acc values for a single thread.
        for (var k = 0; k < ${i/4}; k++) {
          let rowB = t * ${i} + k * 4;
          let BCached = vec4<f32>(mm_readB(batchB, rowB, globalCol),
                              mm_readB(batchB, rowB + 1, globalCol),
                              mm_readB(batchB, rowB + 2, globalCol),
                              mm_readB(batchB, rowB + 3, globalCol));

          let ACached = mm_Asub[k];
          acc = acc + dot(ACached, BCached);
        }

        workgroupBarrier();
      }

      mm_write(batch, globalRow, globalCol, acc);
    }
  `}(this.workgroupSize,this.transposeA):eL(this.elementsPerThread,this.workgroupSize,this.transposeA,this.tileInner,!1,null,this.sequentialAccessByThreads,!0)}
    `}}class eW{constructor(e,t=!1,i=!1,r=null,a=null,s=null){this.variableNames=["A","B"],this.uniforms="dimAOuter : i32, dimBOuter : i32, dimInner : i32,",this.workgroupSize=[256,1,1],this.outputShape=e,this.dispatchLayout={x:[],y:[1,2],z:[0]},this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize);const o=null!=r,n=null!=s;o&&this.variableNames.push("bias"),n&&this.variableNames.push("preluActivationWeights"),this.transposeA=t,this.transposeB=i,this.addBias=o,this.activation=a,this.hasPreluActivationWeights=n,this.shaderKey=`matMulReduce_${this.activation}_${t}_${i}`}getUserCode(){var e;return`
      ${eN(this.activation,this.hasPreluActivationWeights)}
      ${eF(this.addBias,this.activation,this.transposeA,this.transposeB)}
      ${e=this.workgroupSize[0],`
    var<workgroup> sumValues : array<f32, ${e}>;
    ${P()} {
      let coords = getOutputCoords();
      let batch = coords[0];
      let batchA = batch % uniforms.aShape[0];
      let batchB = batch % uniforms.bShape[0];
      let row = coords[1];
      let col = coords[2];
      var sum = 0.0;
      let Length = uniforms.dimInner;
      for (var k = i32(localId.x); k < Length; k = k + ${e}) {
        let dataA = mm_readA(batchA, row, k);
        let dataB = mm_readB(batchB, k, col);
        sum = sum + dataA * dataB;
      }
      sumValues[localId.x] = sum;
      workgroupBarrier();

      for(var currentSize = ${e/2}u; currentSize > 1u;
          currentSize = currentSize / 2u) {
        if (localId.x < currentSize)
        {
          sumValues[localId.x] = sumValues[localId.x] + sumValues[localId.x + currentSize];
        }
        workgroupBarrier();
      }

      if (localId.x == 0u) {
        sum = sumValues[0] + sumValues[1];
        mm_write(batch, row, col, sum);
      }
    }
  `}
    `}}class eO{constructor(e,t,i,r=!1,a=!1,s=null,o=null,n=null){this.variableNames=["A","B"],this.uniforms="dimAOuter : i32, dimBOuter : i32, dimInner : i32,",this.workgroupSize=[16,8,1],this.outputShape=i,this.dispatchLayout={x:[2],y:[1],z:[0]},this.dispatch=[Math.ceil(i[2]/this.workgroupSize[0]),Math.ceil(i[1]/this.workgroupSize[1]),i[0]];const u=null!=s;u&&this.variableNames.push("bias");const l=null!=n;l&&this.variableNames.push("preluActivationWeights"),this.transposeA=r,this.transposeB=a,this.addBias=u,this.activation=o,this.hasPreluActivationWeights=l,this.shaderKey=`matMulSmallOutputSize_${this.activation}_${r}_${a}`}getUserCode(){var e;let t,i,r;return`
      ${eN(this.activation,this.hasPreluActivationWeights)}
      ${eF(this.addBias,this.activation,this.transposeA,this.transposeB)}
      ${t=(e=this.workgroupSize)[1],r=t>(i=e[0])?t:i,`
  var<workgroup> mm_Asub : array<array<f32, ${r}>, ${t}>;
  var<workgroup> mm_Bsub : array<array<f32, ${i}>, ${r}>;

  // If the output size is small for matrix multiplication, avoid to use vec4
  // and handle some elements per thread to optimally utilize the ALU.
  // Read data from global memory to registers firstly, then store them into
  // shared memory, so it is instruction-Level parallelism for arithmetic
  // operations and others handle IO operations between barrier api, makes ALU
  // and load/store units work simultaneously, could improves the performance.
  ${P()} {
    let tileRow = i32(localId.y);
    let tileCol = i32(localId.x);
    let globalRow = i32(globalId.y);
    let globalCol = i32(globalId.x);
    let batch = i32(globalId.z);
    let batchA = batch % uniforms.aShape[0];
    let batchB = batch % uniforms.bShape[0];

    // uniforms.dimInner should be greater than 0.
    let numTiles = (uniforms.dimInner - 1) / ${r} + 1;
    var acc = 0.0;

    var globalColA = tileCol;
    var globalRowB = 0;
    var regA = mm_readA(batchA, globalRow, globalColA);
    var regB0 = mm_readB(batchB, globalRowB + 2 * tileRow, globalCol);
    var regB1 = mm_readB(batchB, globalRowB + 2 * tileRow + 1, globalCol);
    globalColA = globalColA + ${r};
    globalRowB = globalRowB + ${r};

    for (var t = 0; t < numTiles; t = t + 1) {
      mm_Asub[tileRow][tileCol] = regA;
      mm_Bsub[2 * tileRow][tileCol] = regB0;
      mm_Bsub[2 * tileRow + 1][tileCol] = regB1;

      workgroupBarrier();

      regA = mm_readA(batchA, globalRow, globalColA);
      regB0 = mm_readB(batchB, globalRowB + 2 * tileRow, globalCol);
      regB1 = mm_readB(batchB, globalRowB + 2 * tileRow + 1, globalCol);
      globalColA = globalColA + ${r};
      globalRowB = globalRowB + ${r};

      for (var k = 0; k < ${r}; k = k + 1) {
        acc = acc + mm_Asub[tileRow][k] * mm_Bsub[k][tileCol];
      }
      workgroupBarrier();
    }

    mm_write(batch, globalRow, globalCol, acc);
  }
  `}
    `}}class eU{constructor(e,t,i=!1,r=!1){this.variableNames=["A","B"],this.uniforms="dimAOuter : i32, dimBOuter : i32, dimInner : i32,",this.workgroupSize=[8,8,1],this.atomic=!0,this.splitedDimInner=128,y.util.assert(1===e[0],()=>"MatMulSplitKProgram only supports batch = 1."),this.outputShape=e,this.dispatchLayout={x:[2],y:[1],z:[0,3]};const a=(i&&this.outputShape[1]%4==0||!i&&t%4==0)&&this.outputShape[2]%4==0;this.elementsPerThread=[4,4,this.splitedDimInner],this.outputComponent=a?4:1,!a&&(this.outputShape[1]<16&&(this.elementsPerThread[1]=1),this.outputShape[2]<16&&(this.elementsPerThread[0]=1)),this.dispatch=L(this.dispatchLayout,[this.outputShape[0],this.outputShape[1],this.outputShape[2],t],this.workgroupSize,this.elementsPerThread),this.transposeA=i,this.transposeB=r,this.shaderKey=`matMulSplitK_${i}_${r}_${this.elementsPerThread}_${this.outputComponent}`}getUserCode(){let e=this.outputComponent;return`
      ${eT(!1,this.transposeB,!1,!1,!1,e)}
      fn mm_write(batch: i32, row : i32, col : i32, value : ${k(e)}) {
        if (row < uniforms.dimAOuter && col < uniforms.dimBOuter) {
          let coords = vec3<i32>(batch, row, col);
          let flatIndex = getOutputIndexFromCoords(coords);
          // The problem is that we should initialize output to zero before using.
          // Otherwise, the original value will be added to the result.
          for (var i = 0; i < ${e}; i = i + 1) {
            ${I("&result[flatIndex + i]",`${e>1?"value[i]":"value"}`,"float32")}
          }
        }
      }
      ${4===e?e_(this.elementsPerThread,this.workgroupSize,this.transposeA,32,!0,this.splitedDimInner):eL(this.elementsPerThread,this.workgroupSize,this.transposeA,32,!0,this.splitedDimInner)}
    `}}class eM{constructor(e,t=null,i=null,r=null){this.uniforms="",this.variableNames=["x"],this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.addBias=null!=t,this.hasPreluActivationWeights=null!=r,this.activation=i,this.addBias&&this.variableNames.push("bias"),this.hasPreluActivationWeights&&this.variableNames.push("preluActivationWeights"),this.shaderKey=`biasActivation_${i}`}getUserCode(){return`
    ${eN(this.activation,this.hasPreluActivationWeights)}
    ${P("index")} {
      if (index < uniforms.size) {
        let coords = getCoordsFromIndex(index);
        var value = getXByOutputIndex(index);
        ${eD(this.addBias,this.activation)}
        setOutputAtIndex(index, value);
      }
    }
    `}}class eV{constructor(e){this.variableNames=[],this.outputShape=[],this.uniforms="value : f32,",this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.shaderKey="fill"}getUserCode(){return`
    ${P("index")} {
      if (index < uniforms.size) {
        setOutputAtIndex(index, uniforms.value);
      }
    }
  `}}function eG(e){let{backend:t,attrs:i}=e,{shape:r,value:a}=i,{dtype:s}=i;if("string"===(s=s||y.util.inferDtype(a))){let e=y.util.getArrayFromDType(s,y.util.sizeFromShape(r));return e.fill(a),t.makeTensorInfo(r,s,e)}{let e=new eV(r);return t.runWebGPUProgram(e,[],s,[{type:"float32",data:[a]}])}}let eH={kernelName:Y.Fill,backendName:"webgpu",kernelFunc:eG};function eX(e){let{inputs:t,attrs:i}=e,{x:r}=t,{shape:a}=i,s=y.util.sizeFromShape(r.shape),o=y.util.inferFromImplicitShape(a,s),n=y.util.sizeFromShape(o);return y.util.assert(s===n,()=>`The new shape (${o}) has ${n} elements and the old shape (${r.shape}) has ${s} elements. The new shape and old shape must have the same number of elements.`),e.backend.incRef(r.dataId),{dataId:r.dataId,shape:o,dtype:r.dtype}}let eK={kernelName:Y.Reshape,backendName:"webgpu",kernelFunc:eX};function eq({a:e,b:t,transposeA:i,transposeB:r,backend:a,bias:s=null,preluActivationWeights:o=null,leakyreluAlpha:n=0,activation:l=null}){let d,h,c=e.shape.length,f=t.shape.length,m=i?e.shape[c-2]:e.shape[c-1],g=r?t.shape[f-1]:t.shape[f-2],x=i?e.shape[c-1]:e.shape[c-2],w=r?t.shape[f-2]:t.shape[f-1],b=e.shape.slice(0,-2),C=t.shape.slice(0,-2),S=y.util.sizeFromShape(b),v=y.util.sizeFromShape(C),I=j.broadcast_util.assertAndGetBroadcastShape(e.shape.slice(0,-2),t.shape.slice(0,-2)).concat([x,w]);y.util.assert(m===g,()=>`Error in matMul: inner shapes (${m}) and (${g}) of Tensors with shapes ${e.shape} and ${t.shape} and transposeA=${i} and transposeB=${r} must match.`);let k=i?[S,m,x]:[S,x,m],R=r?[v,w,g]:[v,g,w],$=eX({inputs:{x:e},backend:a,attrs:{shape:k}}),P=eX({inputs:{x:t},backend:a,attrs:{shape:R}}),z=[$,P],A=Math.max(S,v),N=[$,P],D=[{type:"int32",data:[x]},{type:"int32",data:[w]},{type:"int32",data:[m]}],T=[A,x,w],F=(0,p.env)().get("WEBGPU_MATMUL_PROGRAM_TYPE");if(F<0){let e=(0,p.env)().getNumber("WEBGPU_THRESHOLD_TO_INCREASE_WORKGROUPS_FOR_MATMUL"),t=e>0?e:a.thresholdToIncreaseWorkgroups,i=A*Math.ceil(x/32)*Math.ceil(w/32);F=i<=t||x<=8&&i<=2*t?A*x*w<=128?u.MatMulReduceProgram:1===A&&g>=2e3?u.MatMulSplitKProgram:u.MatMulSmallOutputSizeProgram:u.MatMulPackedProgram}switch(F){case u.MatMulReduceProgram:d=new eW(T,i,r,s,l,o);break;case u.MatMulSplitKProgram:if(h=eG({backend:a,attrs:{shape:T,value:0,dtype:e.dtype}}),d=new eU(T,g,i,r),s||l){let t=new eM((h=a.runWebGPUProgram(d,N,e.dtype,D,h)).shape,s,l,o),i=null,r=[h];s&&r.push(s),o&&r.push(o),"leakyrelu"===l&&(i=[{type:"float32",data:[n]}],t.uniforms+=" alpha : f32,");let u=a.runWebGPUProgram(t,r,h.dtype,i);z.push(h);let p=eX({inputs:{x:u},backend:a,attrs:{shape:I}});for(let e of(z.push(u),z))a.disposeData(e.dataId);return p}break;case u.MatMulSmallOutputSizeProgram:d=new eO(k,R,T,i,r,s,l,o);break;case u.MatMulPackedProgram:d=new eB(k,T,i,r,s,l,o,a.adapterInfo.isIntel());break;default:throw Error(`Unsupported MatMulProgramType ${F}.`)}s&&N.push(s),o&&N.push(o),"leakyrelu"===l&&(D.push({type:"float32",data:[n]}),d.uniforms+=" alpha : f32,");let _=eX({inputs:{x:h=a.runWebGPUProgram(d,N,e.dtype,D,h)},backend:a,attrs:{shape:I}});for(let e of(z.push(h),z))a.disposeData(e.dataId);return _}let eY={kernelName:Y._FusedMatMul,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{a,b:s,bias:o,preluActivationWeights:n}=t,{transposeA:u,transposeB:l,activation:d,leakyreluAlpha:h}=r;return eq({a,b:s,transposeA:u,transposeB:l,backend:i,bias:o,preluActivationWeights:n,leakyreluAlpha:h,activation:d})}};var ej=e.i(80053);class eQ{constructor(e,t,i){this.variableNames=["AReal","AImag","BReal","BImag"],this.workgroupSize=[128,1,1],this.size=!0,this.outputShape=m.backend_util.assertAndGetBroadcastShape(t,i),this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.shaderKey=`binaryOpComplex_${e}`,this.op=e}getUserCode(){let e=ep(this.op,!1);return`
      fn binaryOpComplex(
          areal : f32, aimag : f32, breal : f32, bimag : f32) -> f32 {
        ${e}
      }

      ${P("index")} {
        if(index < uniforms.size) {
          let areal = getARealByOutputIndex(index);
          let aimag = getAImagByOutputIndex(index);
          let breal = getBRealByOutputIndex(index);
          let bimag = getBImagByOutputIndex(index);
          setOutputAtIndex(index, binaryOpComplex(areal, aimag, breal, bimag));
        }
      }
    `}}class eZ{constructor(e,t,i){if(this.size=!0,this.variableNames=["A","B"],this.outputShape=m.backend_util.assertAndGetBroadcastShape(t,i),this.dispatchLayout=U(this.outputShape),this.op=e,this.useSharedMemoryWithA=t.length<=1&&i.length>1&&t[0]<128,this.useSharedMemoryWithB=i.length<=1&&t.length>1&&i[0]<128,this.useSharedMemoryWithA||this.useSharedMemoryWithB)this.outputComponent=1,this.variableComponents=[1,1],this.lastDimensionSize=this.useSharedMemoryWithB?i[0]:t[0],this.shaderKey=`binary_${e}_${this.lastDimensionSize}`,this.type="shared",this.workgroupSize=[256,1,1];else{const r=t.length>0&&t[t.length-1]%4==0,a=i.length>0&&i[i.length-1]%4==0;r&&a?(this.outputComponent=4,this.variableComponents=[4,4]):r&&(y.util.isScalarShape(i)||1===i[i.length-1])||a&&(y.util.isScalarShape(t)||1===t[t.length-1])?(this.outputComponent=4,this.variableComponents=r?[4,1]:[1,4]):(this.outputComponent=1,this.variableComponents=[1,1]),this.type="nonshared",this.shaderKey=`binary_${e}_${this.variableComponents}`,this.workgroupSize=[128,1,1]}this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize,[this.outputComponent,1,1])}getUserCode(){let e,t=4===this.outputComponent?"vec4<f32>":"f32",i=`
    fn binaryOperation(a : ${t}, b : ${t}) -> ${t} {
      ${ep(this.op,4===this.outputComponent)}
    };
    `;if("shared"===this.type){let t=this.lastDimensionSize>1?`coords[${this.outputShape.length-1}]`:"0",r=this.useSharedMemoryWithB?`let a = getAByOutputIndex(index);
          let b = sharedBuf[${t}];`:`let a = sharedBuf[${t}];
          let b = getBByOutputIndex(index);`;e=`
        ${i}
        var<workgroup> sharedBuf : array<f32, ${this.lastDimensionSize}>;
        ${P("index")} {
          // Fill in the shared memory buffer.
          let localIndex = i32(localId.x);
          if(localIndex < ${this.lastDimensionSize}) {
            sharedBuf[localIndex] = f32(${this.useSharedMemoryWithB?"B":"A"}[localIndex]);
          }
          workgroupBarrier();

          if(index < uniforms.size) {
            let coords = getCoordsFromIndex(index);
            ${r}
            setOutputAtIndex(index, binaryOperation(a, b));
          }
        }
        `}else e=`
       ${i}
       ${P("index")} {
         if (index < uniforms.size) {
           let coords = getCoordsFromIndex(index * ${this.outputComponent});
           let a = ${t}(getAByOutputCoords(coords));
           let b = ${t}(getBByOutputCoords(coords));
           setOutputAtIndex(index, binaryOperation(a, b));
         }
       }
       `;return e}}function eJ(e){let{inputs:t}=e,{x:i}=t;return e.backend.incRef(i.dataId),{dataId:i.dataId,shape:i.shape,dtype:i.dtype}}let e2={kernelName:Y.Identity,backendName:"webgpu",kernelFunc:eJ};function e0(e){let{inputs:t,backend:i}=e,{real:r,imag:a}=t,s=i.makeTensorInfo(r.shape,"complex64");return i.tensorMap.get(s.dataId).complexTensorInfos={real:eJ({inputs:{x:r},backend:i}),imag:eJ({inputs:{x:a},backend:i})},s}let e1={kernelName:Y.Complex,backendName:"webgpu",kernelFunc:e0};class e3{constructor(e,t,i=""){this.variableNames=["A"],this.size=!0,this.workgroupSize=[128,1,1],this.outputShape=e,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.op=t,""!==i&&(this.uniforms=i),this.shaderKey=`unary_${t}`}getUserCode(){return`
      fn unaryOperation(a : f32) -> f32 {
        ${eA(this.op,!1)}
      }
      ${P("index")} {
        if (index < uniforms.size) {
          let a = getAByOutputIndex(index);
          setOutputAtIndex(index, unaryOperation(a));
        }
      }
      `}}function e4({opType:e,cpuKernelImpl:t,dtype:i}){return({inputs:r,backend:a})=>{let{x:s}=r,o=i||s.dtype;if(a.shouldExecuteOnCPU([s])&&null!=t){let e=t(a.tensorMap.get(s.dataId).values,o);return a.makeTensorInfo(s.shape,o,e)}let n=new e3(s.shape,e);return a.runWebGPUProgram(n,[s],o)}}function e6({opType:e,cpuKernelImpl:t,supportsComplex:i=!1,dtype:r}){return({inputs:a,backend:s})=>{let{a:o,b:n}=a;if(i&&"complex64"===o.dtype){let t,i,r=s.tensorMap.get(o.dataId),a=s.tensorMap.get(n.dataId);if(e!==l.MUL)[t,i]=[[r.complexTensorInfos.real,a.complexTensorInfos.real],[r.complexTensorInfos.imag,a.complexTensorInfos.imag]].map(t=>{let[i,r]=t,a={dataId:i.dataId,dtype:i.dtype,shape:o.shape},u={dataId:r.dataId,dtype:r.dtype,shape:n.shape},l=new eZ(e,o.shape,n.shape);return s.runWebGPUProgram(l,[a,u],(0,ej.upcastType)(i.dtype,r.dtype))});else{let e=new eQ(l.COMPLEX_MULTIPLY_REAL,o.shape,n.shape),u=new eQ(l.COMPLEX_MULTIPLY_IMAG,o.shape,n.shape),d=[{dataId:r.complexTensorInfos.real.dataId,dtype:r.complexTensorInfos.real.dtype,shape:o.shape},{dataId:r.complexTensorInfos.imag.dataId,dtype:r.complexTensorInfos.imag.dtype,shape:o.shape},{dataId:a.complexTensorInfos.real.dataId,dtype:a.complexTensorInfos.real.dtype,shape:n.shape},{dataId:a.complexTensorInfos.imag.dataId,dtype:a.complexTensorInfos.imag.dtype,shape:n.shape}];t=s.runWebGPUProgram(e,d,"float32"),i=s.runWebGPUProgram(u,d,"float32")}let u=e0({inputs:{real:t,imag:i},backend:s});return s.disposeData(t.dataId),s.disposeData(i.dataId),u}let u=r||(0,ej.upcastType)(o.dtype,n.dtype);if(("string"===o.dtype||"string"===n.dtype||s.shouldExecuteOnCPU([o,n]))&&null!=t){let e=s.tensorMap.get(o.dataId).values,i=s.tensorMap.get(n.dataId).values,r="string"===o.dtype?m.backend_util.fromUint8ToStringArray(e):e,a="string"===o.dtype?m.backend_util.fromUint8ToStringArray(i):i,[l,d]=t(o.shape,n.shape,r,a,u);return s.makeTensorInfo(d,u,l)}let d=new eZ(e,o.shape,n.shape);return s.runWebGPUProgram(d,[o,n],u)}}e.s([],246692),e.i(246692);var e5=e.i(563781);function e8(e){return(t,i,r,a,s)=>{let o=m.backend_util.assertAndGetBroadcastShape(t,i),n=o.length,u=y.util.computeStrides(o),l=y.util.sizeFromShape(o),d=y.util.getTypedArrayFromDType(s,l),h=t.length,p=i.length,c=y.util.computeStrides(t),f=y.util.computeStrides(i),g=m.backend_util.getBroadcastDims(t,o),x=m.backend_util.getBroadcastDims(i,o);if(g.length+x.length===0)for(let t=0;t<d.length;++t)d[t]=e(r[t%r.length],a[t%a.length]);else for(let t=0;t<d.length;++t){let i=y.util.indexToLoc(t,n,u),s=i.slice(-h);g.forEach(e=>s[e]=0);let o=y.util.locToIndex(s,h,c),l=i.slice(-p);x.forEach(e=>l[e]=0);let m=y.util.locToIndex(l,p,f);d[t]=e(r[o],a[m])}return[d,o]}}function e9(e){let{inputs:t,backend:i}=e,{real:r,imag:a}=t,s=i.data.get(r.dataId).values,o=i.data.get(a.dataId).values,n=i.makeTensorInfo(r.shape,"complex64");return i.data.get(n.dataId).complexTensorInfos={real:i.makeTensorInfo(r.shape,"float32",s),imag:i.makeTensorInfo(a.shape,"float32",o)},n}function e7(e){let{inputs:t,backend:i}=e,{x:r}=t;return i.incRef(r.dataId),{dataId:r.dataId,shape:r.shape,dtype:r.dtype}}function te(e,t,i,r){if("int32"===r)return[t,"int32",Int32Array.from(e)];if("bool"===r){let r=y.util.toTypedArray([0],i),[a,s]=e8((e,t)=>+(e!==t))(t,[],e,r,"bool");return[s,"bool",a]}throw Error(`Error in Cast: failed to cast ${i} to ${r}`)}function tt(e){let{inputs:t,backend:i,attrs:r}=e,{x:a}=t,{dtype:s}=r;if("complex64"===s){if("complex64"===a.dtype)return e7({inputs:{x:a},backend:i});let e=function e(t,i,r="float32"){if("complex64"===r)return e9({inputs:{real:e(t,i,"float32"),imag:e(t,i,"float32")},backend:t});let a=y.util.makeZerosTypedArray(y.util.sizeFromShape(i),r);return t.makeTensorInfo(i,r,a)}(i,a.shape,a.dtype),t=tt({inputs:{x:a},backend:i,attrs:{dtype:"float32"}}),r=e9({inputs:{real:t,imag:e},backend:i});return i.disposeIntermediateTensorInfo(e),i.disposeIntermediateTensorInfo(t),r}if("complex64"===a.dtype){let e=function(e){let{inputs:t,backend:i}=e,{input:r}=t,a=i.data.get(r.dataId).complexTensorInfos.real,s=i.data.get(a.dataId).values;return i.makeTensorInfo(a.shape,a.dtype,s)}({inputs:{input:a},backend:i}),t=tt({inputs:{x:e},backend:i,attrs:{dtype:s}});return i.disposeIntermediateTensorInfo(e),t}if(!y.util.hasEncodingLoss(a.dtype,s)){let e=e7({inputs:{x:a},backend:i});return{dataId:e.dataId,shape:e.shape,dtype:s}}let[o,n,u]=te(i.data.get(a.dataId).values,a.shape,a.dtype,s);return i.makeTensorInfo(o,n,u)}function ti(e,t,i,r){return null==i?({inputs:i,backend:a})=>{let{a:s,b:o}=i;(0,e5.assertNotComplex)([s,o],e);let n=a.data.get(s.dataId).values,u=a.data.get(o.dataId).values,l="string"===s.dtype?m.backend_util.fromUint8ToStringArray(n):n,d="string"===s.dtype?m.backend_util.fromUint8ToStringArray(u):u,h=r||s.dtype,[p,c]=t(s.shape,o.shape,l,d,h);return a.makeTensorInfo(c,h,p)}:({inputs:e,backend:a})=>{let{a:s,b:o}=e;if("complex64"===s.dtype||"complex64"===o.dtype){let e=tt({inputs:{x:s},backend:a,attrs:{dtype:"complex64"}}),t=a.data.get(e.dataId),r=t.complexTensorInfos.real,n=t.complexTensorInfos.imag,u=a.data.get(r.dataId).values,l=a.data.get(n.dataId).values,d=tt({inputs:{x:o},backend:a,attrs:{dtype:"complex64"}}),h=a.data.get(d.dataId),p=h.complexTensorInfos.real,c=h.complexTensorInfos.imag,f=a.data.get(p.dataId).values,m=a.data.get(c.dataId).values,[g,x,y]=i(s.shape,o.shape,u,l,f,m),w=a.makeTensorInfo(y,"float32",g),b=a.makeTensorInfo(y,"float32",x),C=e9({inputs:{real:w,imag:b},backend:a});return a.disposeIntermediateTensorInfo(e),a.disposeIntermediateTensorInfo(d),a.disposeIntermediateTensorInfo(w),a.disposeIntermediateTensorInfo(b),C}{let e=a.data.get(s.dataId).values,i=a.data.get(o.dataId).values,n=r||s.dtype,[u,l]=t(s.shape,o.shape,e,i,n);return a.makeTensorInfo(l,n,u)}}}function tr(e){return(t,i,r,a,s,o)=>{let n=m.backend_util.assertAndGetBroadcastShape(t,i),u=y.util.sizeFromShape(n),l=n.length,d=y.util.computeStrides(n),h=y.util.getTypedArrayFromDType("float32",u),p=y.util.getTypedArrayFromDType("float32",u),c=m.backend_util.getBroadcastDims(t,n),f=m.backend_util.getBroadcastDims(i,n),g=m.backend_util.mergeRealAndImagArrays(r,a),x=m.backend_util.mergeRealAndImagArrays(s,o),w=t.length,b=y.util.computeStrides(t),C=i.length,S=y.util.computeStrides(i);if(c.length+f.length===0)for(let t=0;t<h.length;t++){let i=t%g.length,r=t%x.length,a=e(g[2*i],g[2*i+1],x[2*r],x[2*r+1]);h[t]=a.real,p[t]=a.imag}else for(let t=0;t<h.length;t++){let i=y.util.indexToLoc(t,l,d),r=i.slice(-w);c.forEach(e=>r[e]=0);let a=y.util.locToIndex(r,w,b),s=i.slice(-C);f.forEach(e=>s[e]=0);let o=y.util.locToIndex(s,C,S),n=e(g[2*a],g[2*a+1],x[2*o],x[2*o+1]);h[t]=n.real,p[t]=n.imag}return[h,p,n]}}Y.Abs,Y.Complex,Y.Identity,Y.Real,Y.Cast;let ta=e8((e,t)=>e+t),ts=tr((e,t,i,r)=>({real:e+i,imag:t+r}));ti(Y.Add,ta,ts),Y.Add;let to=e8((e,t)=>e&t);function tn(e){return(t,i,r)=>{let a=y.util.getArrayFromDType(i,t.length);for(let i=0;i<t.length;++i)a[i]=e(t[i],r);return a}}ti(Y.BitwiseAnd,to),Y.BitwiseAnd;function tu(e,t,i){return({inputs:r,attrs:a,backend:s})=>{let o,{x:n}=r;(0,e5.assertNotComplex)(n,e);let u=s.data.get(n.dataId).values;if("string"===n.dtype){if(!Array.isArray(u))throw Error("String tensor's value was not an instance of Array");o=m.backend_util.fromUint8ToStringArray(u)}else o=u;let l=i||n.dtype,d=t(o,l,a);return s.makeTensorInfo(n.shape,l,d)}}let tl=tn(e=>Math.ceil(e));tu(Y.Ceil,tl),Y.Ceil;var td=e.i(788456);let th=e8((e,t)=>+(e===t));ti(Y.Equal,th,null,"bool"),Y.Equal;let tp=tn(e=>Math.exp(e));tu(Y.Exp,tp,"float32"),Y.Exp;let tc=tn(e=>Math.expm1(e));tu(Y.Expm1,tc),Y.Expm1;let tf=tn(e=>Math.floor(e));tu(Y.Floor,tf),Y.Floor;let tm=e8((e,t)=>Math.floor(e/t));ti(Y.FloorDiv,tm,null,"int32"),Y.FloorDiv;let tg=e8((e,t)=>+(e>t));ti(Y.Greater,tg,null,"bool"),Y.Greater;let tx=e8((e,t)=>+(e>=t));ti(Y.GreaterEqual,tx,null,"bool"),Y.GreaterEqual;let ty=e8((e,t)=>+(e<t));ti(Y.Less,ty,null,"bool"),Y.Less;let tw=e8((e,t)=>+(e<=t));ti(Y.LessEqual,tw,null,"bool"),Y.LessEqual;let tb=tn(e=>Math.log(e));tu(Y.Log,tb),Y.Log;let tC=e8((e,t)=>Math.max(e,t));ti(Y.Maximum,tC),Y.Maximum;let tS=e8((e,t)=>Math.min(e,t));ti(Y.Minimum,tS),Y.Minimum;let tv=e8((e,t)=>e*t),tI=tr((e,t,i,r)=>({real:e*i-t*r,imag:e*r+t*i}));ti(Y.Multiply,tv,tI),Y.Multiply;Y.Neg;let tk=e8((e,t)=>+(e!==t));ti(Y.NotEqual,tk,null,"bool"),Y.NotEqual;function tR(e,t){let i=e.slice(0,t);for(;i.length<t;)i.push(1);for(let r=t;r<e.length;r++)i[t-1]*=e[r];return i}Y.Transpose,Y.Prod;var t$=e.i(866032),tP=e.i(129551),tz=m.backend_util.RowPartitionType;class tA{constructor(e,t,i,r,a,s,o,n,u,l){this.shape=e,this.shapeShape=t,this.values=i,this.valuesShape=r,this.valuesDType=a,this.defaultValue=s,this.defaultValueShape=o,this.rowPartitionValues=n,this.rowPartitionValuesShapes=u,this.rowPartitionTypes=m.backend_util.getRowPartitionTypesHelper(l),this.raggedRank=m.backend_util.getRaggedRank(this.rowPartitionTypes)}getRowPartitionTypeByDimension(e){return this.rowPartitionTypes[0]===tz.FIRST_DIM_SIZE?this.rowPartitionTypes[e+1]:this.rowPartitionTypes[e]}getRowPartitionTensor(e){return this.rowPartitionTypes[0]===tz.FIRST_DIM_SIZE?this.rowPartitionValues[e+1]:this.rowPartitionValues[e]}getMaxWidth(e){let t=this.getRowPartitionTensor(e-1);switch(this.getRowPartitionTypeByDimension(e-1)){case tz.VALUE_ROWIDS:return tA.getMaxWidthValueRowID(t);case tz.ROW_SPLITS:return tA.getMaxWidthRowSplit(t);default:throw Error(`Cannot handle partition type ${tz[this.getRowPartitionTypeByDimension(e-1)]}`)}}static getMaxWidthRowSplit(e){let t=e.length;if(0===t||1===t)return 0;let i=0;for(let r=0;r<t-1;++r){let t=e[r+1]-e[r];t>i&&(i=t)}return i}static getMaxWidthValueRowID(e){let t=e.length;if(0===t)return 0;let i=0,r=e[0],a=0;for(let s=1;s<t;++s){let t=e[s];t!==r&&(r=t,a=Math.max(s-i,a),i=s)}return Math.max(t-i,a)}tensorShapeFromTensor(e,t,i=!0){if(0===t.length){if(-1===e[0])return[];throw Error("The only valid scalar shape tensor is the fully unknown shape specified as -1.")}return tD(e,i)}calculateOutputSize(e){let t=this.valuesShape,i=this.defaultValueShape;m.backend_util.validateDefaultValueShape(i,t);let r=this.tensorShapeFromTensor(this.shape,this.shapeShape),a=m.backend_util.combineRaggedTensorToTensorShapes(this.raggedRank,r,t);a[0]<0&&(a[0]=e);for(let e=1;e<=this.raggedRank;++e)a[e]<0&&(a[e]=this.getMaxWidth(e));return a}calculateFirstParentOutputIndex(e,t,i){let r=Math.min(e,i),a=[],s=0;for(let e=0;e<r;++e,s+=t)a.push(s);for(let t=r;t<e;++t)a.push(-1);return y.util.assert(a.length===e,()=>"Final length of result must be equal to firstDimension."),a}calculateOutputIndexRowSplit(e,t,i,r){let a=e.length,s=[];for(let o=0;o<a-1;++o){let a=e[o+1]-e[o],n=Math.min(r,a),u=t[o];-1===u&&(n=0);for(let e=0;e<n;++e)s.push(u),u+=i;for(let e=0;e<a-n;++e)s.push(-1)}if(a>0&&s.length!==e[a-1])throw Error("Invalid row split size.");return s}calculateOutputIndexValueRowID(e,t,i,r){let a=e.length,s=[];if(0===a)return[];let o=0,n=e[0];if(n>=t.length)throw Error(`Got currentValueRowId=${n}, which is not less than ${t.length}`);let u=t[n];s.push(u);for(let l=1;l<a;++l){let a=e[l];if(a===n)u>=0&&(++o<r?u+=i:u=-1);else{if(o=0,n=a,a>=t.length)throw Error(`Got nextValueRowId=${a} which is not less than ${t.length}`);u=t[a]}s.push(u)}if(s.length!==e.length)throw Error("Invalid row ids.");return s}calculateOutputIndex(e,t,i,r){let a=this.getRowPartitionTensor(e),s=this.getRowPartitionTypeByDimension(e);switch(s){case tz.VALUE_ROWIDS:return this.calculateOutputIndexValueRowID(a,t,i,r);case tz.ROW_SPLITS:if(a.length-1>t.length)throw Error(`Row partition size is greater than output size: ${a.length-1} > ${t.length}`);return this.calculateOutputIndexRowSplit(a,t,i,r);default:throw Error(`Unsupported partition type: ${tz[s]}`)}}getFirstDimensionSize(){let e=this.rowPartitionValues[0];if(0===this.rowPartitionTypes.length)throw Error("No row_partition_types given.");let t=this.rowPartitionTypes[0];switch(t){case tz.FIRST_DIM_SIZE:return e[0];case tz.VALUE_ROWIDS:throw Error("Cannot handle VALUE_ROWIDS in first dimension.");case tz.ROW_SPLITS:return this.rowPartitionValuesShapes[0][0]-1;default:throw Error(`Cannot handle type ${tz[t]}`)}}compute(){if(this.rowPartitionValues[0].length<=0)throw Error("Invalid first partition input. Tensor requires at least one element.");let e=this.getFirstDimensionSize(),t=this.calculateOutputSize(e),i=Array(this.raggedRank+1);i[i.length-1]=1;for(let e=i.length-2;e>=0;--e)i[e]=i[e+1]*t[e+1];let r=tD(t,!1),a=y.util.getArrayFromDType(this.valuesDType,y.util.sizeFromShape(r));if(i[0]*t[0]>0){let s=this.calculateFirstParentOutputIndex(e,i[0],t[0]);for(let e=1;e<=this.raggedRank;++e)s=this.calculateOutputIndex(e-1,s,i[e],t[e]);this.setOutput(this.raggedRank,s,a,r)}return[r,a]}setOutput(e,t,i,r){if(0===i.length)return;let a=this.values,s=r.slice();s=s.slice(e+1);let o=y.util.sizeFromShape(s),n=t.length,u=this.defaultValue;if(u.length!==o&&1!==u.length){let e=this.defaultValueShape;(0,f.tidy)(()=>{let t=(0,tP.reshape)(u,e);u=(0,t$.broadcastTo)(t,s).dataSync()})}let l=0,d=0,h=0;for(let e=0;e<=n;++e){let r=e<n?t[e]:-1;if(r===h){++h;continue}if(d<h){let e=a.subarray(l*o);tN(i.subarray(d*o),e,(h-d)*o)}if(e>=n&&(r=Math.floor(i.length/o)),r>h)if(1===this.defaultValue.length)i.subarray(h*o,r*o).fill(this.defaultValue[0]),h=r;else for(;r>h;)tN(i.slice(h*o),u,o),++h;r<0?(l=e+1,d=h):(l=e,h=(d=h)+1)}}}function tN(e,t,i){for(let r=0;r<i;r++)e[r]=t[r]}function tD(e,t){let i=[];for(let r of e){if(r<0){if(!t)throw Error(`Dimension ${r} must be >= 0`);if(r<-1)throw Error(`Dimension ${r} must be >= -1`);r=-1}i.push(r)}return i}var tT=e.i(223610);let tF=tn(e=>1/Math.sqrt(e));tu(Y.Rsqrt,tF),Y.Rsqrt;var t_=e.i(160233);let tE=tn(e=>1/(1+Math.exp(-e)));tu(Y.Sigmoid,tn(e=>1/(1+Math.exp(-e))),void 0),Y.Sigmoid;var tL=e.i(357316);let tB=tn(e=>Math.sqrt(e));tu(Y.Sqrt,tn(e=>Math.sqrt(e)),void 0),Y.Sqrt;let tW=e8((e,t)=>{let i=e-t;return i*i});ti(Y.SquaredDifference,tW),Y.SquaredDifference;let tO=tn((e,t)=>{let{pattern:i,replaceGlobal:r,rewrite:a}=t;return e.replace(new RegExp(i,r?"g":""),a)});tu(Y.StaticRegexReplace,tO),Y.StaticRegexReplace;var tU=e.i(852198),tM=e.i(450317),tV=e.i(967417);let tG=e8((e,t)=>e-t),tH=tr((e,t,i,r)=>({real:e-i,imag:t-r}));ti(Y.Sub,tG,tH),Y.Sub;let tX=(e,t)=>{let i=t.value-e.value;return 0===i?e.index-t.index:i};var tK=e.i(68991);e.s(["addImpl",0,ta,"bincountImpl",0,function(e,t,i,r,a){let s=y.util.sizeFromShape(r),o=y.util.makeZerosTypedArray(a,i);for(let i=0;i<e.length;i++){let r=e[i];if(r<0)throw Error("Input x must be non-negative!");r>=a||(s>0?o[r]+=t[i]:o[r]+=1)}return o},"bincountReduceImpl",0,function(e,t,i,r=!1){let a=e.shape[0],s=e.shape[1],o=(0,g.buffer)([a,i],t.dtype);for(let n=0;n<a;n++)for(let a=0;a<s;a++){let s=e.get(n,a);if(s<0)throw Error("Input x must be non-negative!");s>=i||(r?o.set(1,n,s):t.size>0?o.set(o.get(n,s)+t.get(n,a),n,s):o.set(o.get(n,s)+1,n,s))}return o},"bitwiseAndImpl",0,to,"castImpl",0,te,"ceilImpl",0,tl,"concatImpl",()=>td.concatImpl,"equalImpl",0,th,"expImpl",0,tp,"expm1Impl",0,tc,"floorDivImpl",0,tm,"floorImpl",0,tf,"gatherNdImpl",0,function(e,t,i,r,a,s,o,n,u){let l=(0,g.buffer)([r,s],i);for(let i=0;i<r;i++){let r=[],d=0;for(let t=0;t<a;t++){let s=e[i*a+t];d+=s*o[t],r.push(s)}if(d<0||d>=u/s)throw Error(`Invalid indices: ${r} does not index into ${n}`);for(let e=0;e<s;e++)l.values[i*s+e]=t.get(...t.indexToLoc(d*s+e))}return l},"gatherV2Impl",0,function(e,t,i){let r=(0,g.buffer)(i,e.dtype);for(let i=0;i<r.size;++i){let a=r.indexToLoc(i).slice(),s=a[0],o=a[2],n=t.locToIndex([s,o]);a[2]=t.values[n];let u=e.locToIndex(a);0<=u&&u<e.values.length&&(r.values[i]=e.values[u])}return r},"greaterEqualImpl",0,tx,"greaterImpl",0,tg,"lessEqualImpl",0,tw,"lessImpl",0,ty,"linSpaceImpl",0,function(e,t,i){let r=(t-e)/(i-1),a=y.util.makeZerosTypedArray(i,"float32");a[0]=e;for(let e=1;e<a.length;e++)a[e]=a[e-1]+r;return a},"logImpl",0,tb,"maxImpl",0,function(e,t,i,r){let a=y.util.getTypedArrayFromDType(r,y.util.sizeFromShape(i));for(let i=0;i<a.length;++i){let r=i*t,s=e[r];for(let i=0;i<t;++i){let t=e[r+i];(Number.isNaN(t)||t>s)&&(s=t)}a[i]=s}return a},"maximumImpl",0,tC,"minimumImpl",0,tS,"multiplyImpl",0,tv,"negImpl",0,function(e,t,i){return tv([],t,y.util.createScalarValue(-1,i),e,i)},"notEqualImpl",0,tk,"prodImpl",0,function(e,t,i,r){let[a,s]=m.backend_util.computeOutAndReduceShapes(e,r),o=(0,ej.upcastType)(t,"int32"),n=y.util.makeZerosTypedArray(y.util.sizeFromShape(a),o),u=y.util.sizeFromShape(s);for(let e=0;e<n.length;++e){let t=e*u,r=1;for(let e=0;e<u;++e)r*=i[t+e];n[e]=r}return{outVals:n,outShape:a,outDtype:o}},"raggedGatherImpl",0,function(e,t,i,r,a,s,o,n){let u,l,d,h;if(0===e.length)throw Error("paramsNestedSplits must be non empty");if(0===t[0].length)throw Error("Split tensors must not be scalars");let p=t[0][0]-1;if(s.forEach((e,t)=>{if(e<0||e>=p){let i=y.util.indexToLoc(t,o.length,y.util.computeStrides(o)).join(",");throw Error(`indices[${i}] = ${e} is not in [0, ${p})`)}}),0===r.length)throw Error("params.rank must be nonzero");let{outSplits:c,valueSlices:f,numValues:m}=function(e,t,i,r){let a=[],s=0,o=Array(t.length-1+i.length).fill(null).map(()=>[0]);for(let e=0;e<i.length;++e){let t=i[e],a=e===i.length-1?r:i[e+1].length;if(0===t.length)throw Error("Ragged splits may not be empty");if(t[0]<0)throw Error("Ragged splits must be non-negative");if(t[t.length-1]>a)throw Error("Ragged splits must not point past values");for(let e=1;e<t.length;++e)if(t[e-1]>t[e])throw Error("Ragged splits must be sorted in ascending order")}let n=1;for(let e=0;e<t.length-1;++e){n*=t[e];let i=t[e+1];for(let t=1;t<n+1;++t)o[e].push(t*i)}for(let r=0;r<e.length;++r){let n=e[r],u=e[r]+1;for(let e=0;e<i.length;++e){let r=i[e],a=e+t.length-1;if(a>=0){let e=o[a],t=e[e.length-1]-r[n];for(let e=n;e<u;++e)o[a].push(r[e+1]+t)}n=r[n],u=r[u]}u!==n&&(a.push([n,u]),s+=u-n)}return{outSplits:o,valueSlices:a,numValues:s}}(s,o,e,r[0]),g=function(e){let t=[];for(let i=0;i<e.length;++i){let r=e[i].length,a=y.util.getArrayFromDType("int32",r);t.push(a),e[i].forEach((e,t)=>a[t]=e)}return t}(c),x=((u=r.slice())[0]=m,l=y.util.getArrayFromDType(a,y.util.sizeFromShape(u)),h=0===(d=i.length)?0:d/r[0],!function(e,t,i,r,a,s){let o=tR(t,2)[1],n=tR(s,2)[1],u=0;for(let t of i)for(let i=t[0];i<t[1];++i){for(let t=0;t<r;++t)a[u*n+t]=e[i*o+t];++u}}(i,r,f,h,l,u),[l,u]);return[g,x[0],x[1]]},"raggedRangeImpl",0,function(e,t,i,r,a,s,o){if(t.length>1)throw Error("starts must be a scalar or vector");if(a.length>1)throw Error("limits must be a scalar or vector");if(o.length>1)throw Error("deltas must be a scalar or vector");let n=0===t.length,u=0===a.length,l=0===o.length,d=[];n||d.push(t[0]),u||d.push(a[0]),l||d.push(o[0]);for(let e=1;e<d.length;++e)if(d[e]!==d[e-1])throw Error("starts, limits, and deltas must have the same shape");let h=0===d.length?1:d[0],p=y.util.getArrayFromDType("int32",h+1);p[0]=0;for(let t=0;t<h;++t){let i,a=n?e[0]:e[t],o=u?r[0]:r[t],d=l?s[0]:s[t];if(0===d)throw Error("Requires delta != 0");if(d>0&&o<a||d<0&&o>a)i=0;else if((i=Math.ceil(Math.abs((o-a)/d)))>0x7fffffff)throw Error("Requires ((limit - start) / delta) <= 2147483647");p[t+1]=p[t]+i}let c=p[h],f=y.util.getArrayFromDType(i,c),m=0;for(let t=0;t<h;++t){let i=p[t+1]-p[t],r=n?e[0]:e[t],a=l?s[0]:s[t];for(let e=0;e<i;++e)f[m++]=r,r+=a}return[p,f]},"raggedTensorToTensorImpl",0,function(e,t,i,r,a,s,o,n,u,l){return new tA(e,t,i,r,a,s,o,n,u,l).compute()},"rangeImpl",()=>tT.rangeImpl,"rsqrtImpl",0,tF,"scatterImpl",0,function(e,t,i,r,a,s,o,n,u,l){let d=e.values,h=t.values;if(0===r)return(0,g.buffer)(i,t.dtype);let p=u instanceof t_.TensorBuffer?u:(0,g.buffer)([r/a,a],t.dtype);"string"==typeof u||"number"==typeof u?p.values.fill(u):"boolean"==typeof u&&p.values.fill(+u);for(let e=0;e<s;e++){let s=[],u=0;for(let t=0;t<o;t++){let i=d[e*o+t];s.push(i),u+=i*n[t]}if(u<0||u>=r/a)throw Error(`Invalid indices: ${s} does not index into ${i}`);for(let i=0;i<a;i++)l?p.values[u*a+i]+=h[e*a+i]:p.values[u*a+i]=0===t.rank?h[0]:h[e*a+i]}return p},"sigmoidImpl",0,tE,"simpleAbsImpl",0,function(e){let t=new Float32Array(e.length);for(let i=0;i<e.length;++i)t[i]=Math.abs(e[i]);return t},"sliceImpl",()=>tL.sliceImpl,"sparseFillEmptyRowsImpl",0,function(e,t,i,r,a,s,o){let n=t[0],u=s[0],l=Array(u),d=Array(n),h=t[1];if(0===u){if(0!==n)throw Error(m.backend_util.getSparseFillEmptyRowsIndicesDenseShapeMismatch(n));return[y.util.getArrayFromDType(i,0),[0,h],y.util.getArrayFromDType(a,0),l,d]}let p=!0,c=0,f=Array(u).fill(0);for(let t=0;t<n;++t){let i=e[t*h];if(i<0)throw Error(m.backend_util.getSparseFillEmptyRowsNegativeIndexErrorMessage(t,i));if(i>=u)throw Error(m.backend_util.getSparseFillEmptyRowsOutOfRangeIndexErrorMessage(t,i,u));++f[i],p=p&&i>=c,c=i}let g=!0;for(let e=0;e<u;++e){let t=0===f[e];l[e]=t,g=g&&!t,f[e]=Math.max(f[e],1),e>0&&(f[e]+=f[e-1])}if(g&&p){for(let e=0;e<n;++e)d[e]=e;return[e,[n,h],r,l,d]}{let t=f[u-1],s=y.util.getArrayFromDType(i,t*h),p=y.util.getArrayFromDType(a,t),c=Array(u).fill(0);for(let t=0;t<n;++t){let i=e[t*h],a=c[i],o=(0===i?0:f[i-1])+a;c[i]++;for(let i=0;i<h;++i)s[o*h+i]=e[t*h+i];p[o]=r[t],d[t]=o}for(let e=0;e<u;++e)if(0===c[e]){let t=0===e?0:f[e-1];s[t*h+0]=e;for(let e=1;e<h;++e)s[t*h+e]=0;p[t]=o}return[s,[t,h],p,l,d]}},"sparseReshapeImpl",0,function(e,t,i,r,a){let s=y.util.sizeFromShape(r),o=t[0],n=a.length,u=[],l=1,d=-1;for(let e=0;e<n;++e){let t=a[e];if(-1===t){if(-1!==d)throw Error(m.backend_util.getSparseReshapeMultipleNegativeOneOutputDimErrorMessage(d,e));d=e,u.push(1)}else{if(t<0)throw Error(m.backend_util.getSparseReshapeNegativeOutputDimErrorMessage(e,t));l*=t,u.push(t)}}if(-1!==d){if(l<=0)throw Error(m.backend_util.getSparseReshapeEmptyTensorZeroOutputDimErrorMessage());let e=Math.trunc(s/l);if(l*e!==s)throw Error(m.backend_util.getSparseReshapeInputOutputMultipleErrorMessage(r,u));u[d]=e}if(y.util.sizeFromShape(u)!==s)throw Error(m.backend_util.getSparseReshapeInputOutputMismatchErrorMessage(r,u));let h=r.length,p=[];if(h>0){p[h-1]=1;for(let e=h-2;e>=0;--e)p[e]=p[e+1]*r[e+1]}let c=[];if(n>0){c[n-1]=1;for(let e=n-2;e>=0;--e)c[e]=c[e+1]*u[e+1]}let f=y.util.getArrayFromDType(i,o*n);for(let t=0;t<o;++t){let i=0;for(let r=0;r<h;++r)i+=e[t*h+r]*p[r];for(let e=0;e<n;++e)f[t*n+e]=Math.trunc(i/c[e]),i%=c[e]}return[f,[o,n],u]},"sparseSegmentReductionImpl",0,function(e,t,i,r,a,s=!1,o=0){let n=r.length,u=[t[0],e.length/t[0]],l=u[1],d=n>0?a[n-1]+1:0;if(d<0)throw Error(m.backend_util.getSparseSegmentReductionNegativeSegmentIdsErrorMessage());let h=t.slice();h[0]=d;let p=h.reduce((e,t)=>e*t,1),c=y.util.getArrayFromDType(i,p);if(0===n)return d>0&&c.fill(o),[c,h];if(d<=0)throw Error(m.backend_util.getSparseSegmentReductionNegativeSegmentIdsErrorMessage());let f=0,g=1,x=0,w=a[0];for(;;){let t=0;if(g<n){if(w===(t=a[g])){++g;continue}if(w>=t)throw Error(m.backend_util.getSparseSegmentReductionNonIncreasingSegmentIdsErrorMessage())}if(w<0||w>=d)throw Error(m.backend_util.getSparseSegmentReductionSegmentIdOutOfRangeErrorMessage(w,d));w>x&&c.fill(o,x*l,w*l);for(let t=f;t<g;++t){let i=r[t];if(i<0||i>=u[0])throw Error(m.backend_util.getSparseSegmentReductionIndicesOutOfRangeErrorMessage(t,r[t],u[0]));for(let t=0;t<l;t++)c[w*l+t]+=e[i*l+t]}if(s)for(let e=0;e<l;e++)c[w*l+e]/=g-f;if(f=g,++g,x=w+1,w=t,g>n)break}return x<d&&c.fill(o,x*l,d*l),[c,h]},"sqrtImpl",0,tB,"squaredDifferenceImpl",0,tW,"staticRegexReplaceImpl",0,tO,"stridedSliceImpl",0,function(e,t,i,r){let a=(0,g.buffer)(e,t.dtype);for(let e=0;e<a.size;e++){let s=a.indexToLoc(e),o=Array(s.length);for(let e=0;e<o.length;e++)o[e]=s[e]*i[e]+r[e];a.set(t.get(...o),...s)}return a},"stringNGramsImpl",()=>tU.stringNGramsImpl,"stringSplitImpl",()=>tM.stringSplitImpl,"stringToHashBucketFastImpl",()=>tV.stringToHashBucketFastImpl,"subImpl",0,tG,"tileImpl",0,function(e,t){let i=Array(e.rank);for(let r=0;r<i.length;r++)i[r]=e.shape[r]*t[r];let r=(0,g.buffer)(i,e.dtype);for(let t=0;t<r.values.length;++t){let i=r.indexToLoc(t),a=Array(e.rank);for(let t=0;t<a.length;t++)a[t]=i[t]%e.shape[t];let s=e.locToIndex(a);r.values[t]=e.values[s]}return r},"topKImpl",0,function(e,t,i,r,a){let s=t[t.length-1],[o,n]=[e.length/s,s],u=y.util.getTypedArrayFromDType(i,o*r),l=y.util.getTypedArrayFromDType("int32",o*r);for(let t=0;t<o;t++){let i=t*n,s=e.subarray(i,i+n),o=Array(s.length);s.forEach((e,t)=>o[t]={value:e,index:t}),r<o.length&&(!function e(t,i,r=0,a=t.length-1){for(;a>r;){if(a-r>600){let s=a-r+1,o=i-r+1,n=Math.log(s),u=.5*Math.exp(2*n/3),l=.5*Math.sqrt(n*u*(s-u)/s)*Math.sign(o-s/2),d=Math.max(r,Math.floor(i-o*u/s+l)),h=Math.min(a,Math.floor(i+(s-o)*u/s+l));e(t,i,d,h)}let s=t[i],o=r,n=a;for(y.util.swap(t,r,i),tX(t[a],s)>0&&y.util.swap(t,r,a);o<n;){for(y.util.swap(t,o,n),o++,n--;0>tX(t[o],s);)o+=1;for(;tX(t[n],s)>0;)n-=1}0===tX(t[r],s)?y.util.swap(t,r,n):(n+=1,y.util.swap(t,n,a)),n<=i&&(r=n+1),i<=n&&(a=n-1)}}(o,r),o=o.slice(0,r)),a&&o.sort(tX);let d=t*r,h=u.subarray(d,d+r),p=l.subarray(d,d+r);for(let e=0;e<r;e++)h[e]=o[e].value,p[e]=o[e].index}let d=t.slice();return d[d.length-1]=r,[(0,g.buffer)(d,i,u),(0,g.buffer)(d,"int32",l)]},"transposeImpl",0,function(e,t,i,r,a){let s=t.length,o=y.util.sizeFromShape(t),n=y.util.computeStrides(t),u=y.util.computeStrides(a),l=y.util.getTypedArrayFromDType(i,y.util.sizeFromShape(a));for(let t=0;t<o;++t){let i=y.util.indexToLoc(t,s,n),a=Array(i.length);for(let e=0;e<a.length;e++)a[e]=i[r[e]];l[y.util.locToIndex(a,s,u)]=e[t]}return l},"uniqueImpl",()=>tK.uniqueImpl],489062);let{addImpl:tq,castImpl:tY,ceilImpl:tj,concatImpl:tQ,equalImpl:tZ,expImpl:tJ,expm1Impl:t2,floorImpl:t0,floorDivImpl:t1,gatherNdImpl:t3,gatherV2Impl:t4,greaterEqualImpl:t6,greaterImpl:t5,lessEqualImpl:t8,lessImpl:t9,logImpl:t7,maxImpl:ie,maximumImpl:it,minimumImpl:ii,multiplyImpl:ir,negImpl:ia,notEqualImpl:is,prodImpl:io,rangeImpl:iu,rsqrtImpl:il,scatterImpl:id,simpleAbsImpl:ih,sliceImpl:ip,stridedSliceImpl:ic,stringNGramsImpl:im,subImpl:ig,tileImpl:ix,topKImpl:iy,transposeImpl:iw,uniqueImpl:ib}=e.i(489062),iC=e4({opType:d.ABS,cpuKernelImpl:ih}),iS={kernelName:Y.Abs,backendName:"webgpu",kernelFunc:iC},iv=e4({opType:d.ACOS}),iI={kernelName:Y.Acos,backendName:"webgpu",kernelFunc:iv},ik=e4({opType:d.ACOSH}),iR={kernelName:Y.Acosh,backendName:"webgpu",kernelFunc:ik},i$=e6({opType:l.ADD,cpuKernelImpl:tq,supportsComplex:!0}),iP={kernelName:Y.Add,backendName:"webgpu",kernelFunc:i$};class iz{constructor(e){this.workPerThread=1,this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e[0],this.variableNames=e.map((e,t)=>`T${t}`),this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize,[this.workPerThread,1,1]),this.shaderKey="addN"}getUserCode(){let e=[];this.variableNames.forEach(t=>{e.push(`let v${t} = get${t}ByOutputCoords(coords);`)});let t=this.variableNames.map(e=>`v${e}`).join(" + ");return`
      ${P("index")} {
        for (var i = 0; i < ${this.workPerThread}; i = i + 1) {
          let flatIndex = index * ${this.workPerThread} + i;
          if (flatIndex < uniforms.size) {
            let coords = getCoordsFromIndex(flatIndex);
            ${e.join("\n        ")}
            setOutputAtIndex(flatIndex, ${t});
          }
        }
      }
    `}}let iA={kernelName:Y.AddN,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i}=e;if(1===t.length)return eJ({inputs:{x:t[0]},backend:i});let r=t.map(e=>e.dtype).reduce((e,t)=>(0,ej.upcastType)(e,t)),a=new iz(t.map(e=>e.shape));return i.runWebGPUProgram(a,t,r)}};class iN{constructor(e,t){this.variableNames=["A"],this.workgroupSize=[16,16,1];const i=Array(e.length);for(let r=0;r<i.length;r++)i[r]=e[t[r]];this.outputShape=i,this.dispatchLayout={x:[0],y:[1]},this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize,[1,1,1]),this.shaderKey="transposeShared"}getUserCode(){y.util.assert(this.workgroupSize[0]===this.workgroupSize[1],()=>`Must be a square tile, current tile shape is ${this.workgroupSize[0]} x ${this.workgroupSize[1]}`);let e=this.workgroupSize[0];return`
      var<workgroup> tile : array<array<f32, ${this.workgroupSize[0]+1}>, ${this.workgroupSize[0]}>;
      ${P()} {
        var x = i32(workgroupId.x) * ${e} + i32(localId.x);
        var y = i32(workgroupId.y) * ${e} + i32(localId.y);
        let width = uniforms.outShape[0];
        let height = uniforms.outShape[1];
        if (x < width && y < height) {
          tile[localId.y][localId.x] = f32(A[y * width + x]);
        }
        workgroupBarrier();

        x = i32(workgroupId.y) * ${e} + i32(localId.x);
        y = i32(workgroupId.x) * ${e} + i32(localId.y);
        if (x < height && y < width) {
          setOutputAtIndex((y * height + x), tile[localId.x]
            [localId.y]);
        }
      }
    `}}class iD{constructor(e,t){this.variableNames=["A"],this.workPerThread=1,this.workgroupSize=[64,1,1],this.size=!0;const i=Array(e.length);for(let r=0;r<i.length;r++)i[r]=e[t[r]];this.outputShape=i,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize,[this.workPerThread,1,1]),this.newDim=t,this.shaderKey=`transpose_${t}`}getUserCode(){let e=R(this.outputShape.length),t=iT(this.newDim);return`
      ${P("index")} {
        for(var i = 0; i < ${this.workPerThread}; i = i + 1) {
          let flatIndex = index * ${this.workPerThread} + i;
          if(flatIndex < uniforms.size) {
            let coords = getCoordsFromIndex(flatIndex);
            setOutputAtIndex(flatIndex, A[getIndexFromCoords${this.outputShape.length}D(
              ${e}(${t}), uniforms.aShape)]);
          }
        }
      }
    `}}function iT(e){let t=e.length;if(t>6)throw Error(`Transpose for rank ${t} is not yet supported`);let i=Array(t);for(let t=0;t<e.length;t++)i[e[t]]=`coords.${$(t)}`;return i.join()}function iF(e){let{inputs:t,backend:i,attrs:r}=e,{x:a}=t,{perm:s}=r,o=Array(a.shape.length);for(let e=0;e<o.length;e++)o[e]=a.shape[s[e]];if(i.shouldExecuteOnCPU([a])){let e=iw(i.tensorMap.get(a.dataId).values,a.shape,a.dtype,s,o);return i.makeTensorInfo(o,a.dtype,e)}if(2===a.shape.length&&y.util.arraysEqual(s,[1,0])){let e=new iN(a.shape,s);return i.runWebGPUProgram(e,[a],a.dtype)}let n=new iD(a.shape,s);return i.runWebGPUProgram(n,[a],a.dtype)}let i_={kernelName:Y.Transpose,backendName:"webgpu",kernelFunc:iF};class iE{constructor(e,t,i){this.variableNames=["x"],this.uniforms="reduceSize : i32,",this.size=!0,this.inputShape=[e.batchSize,e.inSize];const[r]=m.backend_util.computeOutAndReduceShapes(this.inputShape,[1]);this.outputShape=0===r.length?[1]:r,e.inSize>=32768&&i>=512?this.workgroupSize=[512,1,1]:e.inSize>=4096?this.workgroupSize=[256,1,1]:this.workgroupSize=[64,1,1],this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,[1,1,1]),this.reduceType=t,this.shaderKey=`reduce_${t}`}getUserCode(){let e="",t="0.0",i=this.workgroupSize[0];"min"===this.reduceType||"max"===this.reduceType?(e=`
         if (isnan(candidate)) {
          bestValue = uniforms.NAN;
         } else if (!isnan(bestValue) && candidate ${"min"===this.reduceType?"<":">"} bestValue)
           {  bestValue = candidate; }`,t="f32(x[offset])"):"sum"===this.reduceType||"mean"===this.reduceType?e=" bestValue = bestValue + candidate; ":"prod"===this.reduceType?(e=" bestValue = bestValue * candidate; ",t="1.0"):"all"===this.reduceType?(e=" bestValue = f32(bestValue >= 1.0 && candidate >= 1.0); ",t="1.0"):"any"===this.reduceType&&(e=" bestValue = f32(bestValue >= 1.0 || candidate >= 1.0); ",t="0.0");let r="mean"===this.reduceType?"setOutputAtIndex(outputIndex, bestValue / f32(uniforms.reduceSize));":"setOutputAtIndex(outputIndex, bestValue);",a=`
         var<workgroup> xBestValues : array<f32, ${i}>;
       `;return`
       fn DIV_CEIL(a : u32, b : u32) -> u32 {
        return ((a - 1u) / b + 1u);
       }

       ${a}
       fn getOffset(outputIndex : i32) -> i32 {
         let outputCoords = getCoordsFromIndex(outputIndex);
         let offset = ${1===this.outputShape.length?"outputCoords":"outputCoords[0]"} * uniforms.reduceSize;
          return offset;
       }
       ${P("index")} {
         let outputIndex = index / ${i};
         let offset = getOffset(outputIndex);
         var bestValue = ${t};
         let Length = uniforms.reduceSize;
         let WorkPerThread = DIV_CEIL(u32(Length), ${i}u);
         for (var k = i32(localId.x); k < Length && outputIndex < uniforms.size;
             k = k + ${i}) {
           let candidate = f32(x[offset + k]);
           ${e}
         }
         xBestValues[localId.x] = bestValue;
         workgroupBarrier();

         var reduceSize = min(u32(Length), ${i}u);
         for (var currentSize = reduceSize / 2u; reduceSize > 1u;
             currentSize = reduceSize / 2u) {
           let interval = DIV_CEIL(reduceSize, 2u);
           if (localId.x < currentSize) {
            let candidate = xBestValues[localId.x + interval];
            ${e}
            xBestValues[localId.x] = bestValue;
           }
           reduceSize = interval;
           workgroupBarrier();
         }

         if (localId.x == 0u && outputIndex < uniforms.size) {
          ${r}
        }
       }
     `}}let iL={mean:"float32",all:"bool",any:"bool"};function iB(e,t,i,r,a){let s,o=e.shape.length,n=[],u=y.util.parseAxisParam(t,e.shape),l=u,d=m.backend_util.getAxesPermutation(l,o),h=e;null!=d&&(h=iF({inputs:{x:e},attrs:{perm:d},backend:a}),l=m.backend_util.getInnerMostAxes(l.length,o),n.push(h)),m.backend_util.assertAxesAreInnerMostDims(r,l,o);let[p,c]=m.backend_util.computeOutAndReduceShapes(h.shape,l),f=p;if(i&&(f=m.backend_util.expandShapeToKeepDim(p,u)),("max"===r||"prod"===r)&&a.shouldExecuteOnCPU([h])){let t=a.tensorMap.get(h.dataId).values;switch(r){case"max":let i=ie(t,y.util.sizeFromShape(c),f,e.dtype);s=a.makeTensorInfo(f,e.dtype,i);break;case"prod":let{outVals:o,outShape:n,outDtype:u}=io(h.shape,h.dtype,t,l);s=a.makeTensorInfo(n,u,o);break;default:throw Error(`${r} CPU implementation is not yet supported.`)}}else{let t=y.util.sizeFromShape(c),i=y.util.sizeFromShape(h.shape)/t,o=iL[r]||(0,ej.sumOutType)(e.dtype),u=new iE({windowSize:t,inSize:t,batchSize:i,outSize:1},r,a.device.limits.maxComputeWorkgroupSizeX),l=a.runWebGPUProgram(u,[h],o,[{type:"int32",data:[t]}]);n.push(l),s=eX({inputs:{x:l},attrs:{shape:f},backend:a})}return n.forEach(e=>a.disposeData(e.dataId)),s}let iW={kernelName:Y.All,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a}=t,{keepDims:s,axis:o}=r;return iB(a,o,s,"all",i)}},iO={kernelName:Y.Any,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a}=t,{keepDims:s,axis:o}=r;return iB(a,o,s,"any",i)}};class iU{constructor(e,t,i){this.workgroupSize=[64,1,1],this.variableNames=["x"],this.uniforms="infinityValue : f32,",this.size=!0,this.op="min"===i?"<":">";const[r,a]=m.backend_util.computeOutAndReduceShapes(e,[t]);this.outputShape=0===r.length?[1]:r,this.dispatchLayout=U(this.outputShape),32>y.util.sizeFromShape(a)?(this.type="plain",this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize)):(this.type="shared",this.dispatch=L(this.dispatchLayout,this.outputShape,[1,1,1])),this.inputShape=e,this.shaderKey=`argMinMax_${this.op}_${this.type}`}getUserCode(){let e=this.workgroupSize[0],t=()=>1===this.inputShape.length?"uniforms.xShape":`uniforms.xShape.${$(this.inputShape.length-1)}`,i=()=>{let e="";if(1===this.outputShape.length)1!==this.inputShape.length&&(e+="outputCoords,");else for(let t=0;t<this.outputShape.length;t++)e+=`outputCoords.${$(t)},`;return e};if("shared"!==this.type)return`
      ${P("index")} {
        if (index < uniforms.size) {
          let outputCoords = getCoordsFromIndex(index);
          var bestIndex = 0;
          var bestValue = getX(${i()} 0);
          let reduceLength = ${t()};
          for (var i = 1; i < reduceLength; i++) {
            let candidate = getX(${i()} i);
            if (candidate ${this.op} bestValue) {
              bestValue = candidate;
              bestIndex = i;
            }
          }
          setOutputAtIndexI32(index, bestIndex);
        }
      }
      `;{let r=`
      var<workgroup> xBestIndices : array<i32, ${e}>;
      var<workgroup> xBestValues : array<f32, ${e}>;
    `;return`
      fn DIV_CEIL(a : u32, b : u32) -> u32 {
        return ((a - 1u) / b + 1u);
      }

      ${r}

      ${P("index")} {
        let outputIndex = index / ${e};
        let reduceLength = ${t()};

        var bestIndex = i32(localId.x);
        var bestValue = uniforms.infinityValue;
        let outputCoords = getCoordsFromIndex(outputIndex);
        for (var k = i32(localId.x); k < reduceLength && outputIndex < uniforms.size;
            k = k + ${e}) {
          let candidate = getX(${i()} k);
          if (!isnan(candidate) && candidate ${this.op} bestValue) {
            bestValue = candidate;
            bestIndex = k;
          }
        }
        xBestValues[localId.x] = bestValue;
        xBestIndices[localId.x] = bestIndex;
        workgroupBarrier();

        var reduceSize = min(u32(reduceLength), ${e}u);
        for (var currentSize = reduceSize / 2u; reduceSize > 1u;
            currentSize = reduceSize / 2u) {
          let interval = DIV_CEIL(reduceSize, 2u);
          if (localId.x < currentSize) {
            let candidate = xBestValues[localId.x + interval];
            if (candidate ${this.op} bestValue) {
              bestValue = candidate;
              xBestValues[localId.x] = bestValue;
              xBestIndices[localId.x] = xBestIndices[localId.x + interval];
            }
          }
          reduceSize = interval;
          workgroupBarrier();
        }

        if (localId.x == 0u && outputIndex < uniforms.size) {
          setOutputAtIndexI32(outputIndex, xBestIndices[localId.x]);
        }
      }
    `}}}let iM={kernelName:Y.ArgMax,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a}=t,{axis:s}=r,o=y.util.parseAxisParam(s,a.shape),n=m.backend_util.getAxesPermutation(o,a.shape.length),u=a,l=[];null!=n&&(l.push(u=iF({inputs:{x:a},backend:i,attrs:{perm:n}})),o=m.backend_util.getInnerMostAxes(o.length,u.shape.length)),m.backend_util.assertAxesAreInnerMostDims("argMax",[o[0]],u.shape.length);let d=new iU(u.shape,o[0],"max"),h=i.runWebGPUProgram(d,[u],"int32",[{type:"float32",data:[-1/0]}]);return l.forEach(e=>i.disposeData(e.dataId)),h}},iV={kernelName:Y.ArgMin,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a}=t,{axis:s}=r,o=y.util.parseAxisParam(s,a.shape),n=m.backend_util.getAxesPermutation(o,a.shape.length),u=a,l=[];null!=n&&(l.push(u=iF({inputs:{x:a},backend:i,attrs:{perm:n}})),o=m.backend_util.getInnerMostAxes(o.length,u.shape.length)),m.backend_util.assertAxesAreInnerMostDims("argMin",[o[0]],u.shape.length);let d=new iU(u.shape,o[0],"min"),h=i.runWebGPUProgram(d,[u],"int32",[{type:"float32",data:[1/0]}]);return l.forEach(e=>i.disposeData(e.dataId)),h}},iG=e4({opType:d.ASIN}),iH={kernelName:Y.Asin,backendName:"webgpu",kernelFunc:iG},iX=e4({opType:d.ASINH}),iK={kernelName:Y.Asinh,backendName:"webgpu",kernelFunc:iX},iq=e4({opType:d.ATAN}),iY={kernelName:Y.Atan,backendName:"webgpu",kernelFunc:iq},ij=e6({opType:l.ATAN2}),iQ={kernelName:Y.Atan2,backendName:"webgpu",kernelFunc:ij},iZ=e4({opType:d.ATANH}),iJ={kernelName:Y.Atanh,backendName:"webgpu",kernelFunc:iZ};class i2{constructor(e){this.variableNames=["x"],this.uniforms="strides : vec2<i32>,",this.workgroupSize=[256,1,1],this.size=!0,this.outputShape=e.outShape,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.shaderKey="poolWithFilterSizeEqualsOne"}getUserCode(){return`
      ${P("index")} {
        if (index < uniforms.size) {
          let coords = getCoordsFromIndex(index);
          let batch = coords[0];
          let d = coords[3];

          let xRCCorner = coords.yz * uniforms.strides;
          let xRCorner = xRCCorner.x;
          let xCCorner = xRCCorner.y;

          let value = getX(batch, xRCorner, xCCorner, d);
          setOutputAtIndex(index, value);
        }
      }
    `}}class i0{constructor(e,t,i=!1,r=!1,a=!1){if(this.variableNames=["x"],this.uniforms="strides : vec2<i32>, pads : vec2<i32>, dilations : vec2<i32>, convDims : vec2<i32>, filterDims : vec2<i32>,",this.workgroupSize=[128,1,1],this.size=!0,"avg"===t&&i)throw Error("Cannot compute positions for average pool.");this.outputShape=e.outShape,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.poolType=t,this.computePositions=i,this.flattenPositions=r,this.includeBatchIndex=a,this.shaderKey=`pool2D_${t}_${i}_${r}_${a}`}getUserCode(){let e;if("avg"===this.poolType)e="resultValue = resultValue + value; count = count + 1.0;";else if(this.computePositions){let t=this.flattenPositions?this.includeBatchIndex?"((batch * uniforms.xShape[1] + xR) * uniforms.xShape[2] + xC) * uniforms.xShape[3] + d":"(xR * uniforms.xShape[2] + xC) * uniforms.xShape[3] + d":"wR * uniforms.filterDims.y + wC";e=`let currMaxValue = mix(value, maxValue, maxValueFound);
      if (value >= currMaxValue) {
        maxValue = value;
        maxValueFound = 1.0;
        maxPosition = ${t};
      }`}else e="resultValue = max(value, resultValue);";let t="resultValue";return"avg"===this.poolType&&(t="resultValue / max(count, 1.0)"),`
      ${P("index")} {
      if (index < uniforms.size) {
        let coords = getCoordsFromIndex(index);
          let batch = coords[0];
          let d = coords[3];
          let xRCCorner = vec2<i32>(coords.yz) * uniforms.strides - uniforms.pads;
          let xRCorner = xRCCorner.x;
          let xCCorner = xRCCorner.y;

          ${this.computePositions?`var maxValue = 0.0;
            var maxValueFound = 0.0;
            var maxPosition = 0;`:`var resultValue = ${"avg"===this.poolType?"0.0":"-1.0 / pow(10.0, -20.0)"};`}

          var count = 0.0;
          for (var wR = 0; wR < uniforms.filterDims.x; wR = wR + uniforms.dilations.x) {
            let xR = xRCorner + wR;

            if (xR < 0 || xR >= uniforms.convDims.x) {
              continue;
            }

            for (var wC = 0; wC < uniforms.filterDims.y; wC = wC + uniforms.dilations.y) {
              let xC = xCCorner + wC;
              if (xC < 0 || xC >= uniforms.convDims.y) {
                continue;
              }

              let value = getX(batch, xR, xC, d);
              ${e}
            }
          }

          ${this.computePositions?"setOutputAtIndexI32(index, maxPosition);":`setOutputAtIndex(index, ${t});`}
        }
      }
    `}}class i1{constructor(e,t,i=!1,r=!1,a=!1){if(this.variableNames=["x"],this.uniforms="strides : vec3<i32>, pads : vec3<i32>, convDims : vec3<i32>, filterDims : vec3<i32>,",this.workgroupSize=[128,1,1],this.size=!0,"avg"===t&&i)throw Error("Cannot compute positions for average pool.");this.outputShape=e.outShape,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.poolType=t,this.computePositions=i,this.flattenPositions=r,this.includeBatchIndex=a,this.shaderKey=`pool3D_${t}_${i}_${r}_${a}`}getUserCode(){let e;if("avg"===this.poolType)e="resultValue += value; count += 1.0;";else if(this.computePositions){let t=this.flattenPositions?this.includeBatchIndex?"(((batch * uniforms.xShape.y + xD) * uniforms.xShape.z + xR) * uniforms.xShape.w + xC) * uniforms.xShape.u + ch":"((xD * uniforms.xShape.z + xR) * uniforms.xShape.w + xC) * uniforms.xShape.u + ch":"wD * uniforms.filterDims.y * uniforms.filterDims.y + wR * uniforms.filterDims.z + wC";e=`let currMaxValue = mix(value, maxValue, maxValueFound);
      if (value >= currMaxValue) {
        maxValue = value;
        maxValueFound = 1.0;
        maxPosition = ${t};
      }`}else e="resultValue = max(value, resultValue);";let t="resultValue";return"avg"===this.poolType&&(t="resultValue / max(count, 1.0)"),`
      ${P("index")} {
        if (index < uniforms.size) {
          let coords = getCoordsFromIndex(index);
          let batch = coords.x;
          let ch = coords.u;

          let xCorner = vec3<i32>(coords.y, coords.z, coords.w) * uniforms.strides - uniforms.pads;
          let xDCorner = xCorner.x;
          let xRCorner = xCorner.y;
          let xCCorner = xCorner.z;

          ${this.computePositions?`var maxValue = 0.0;
            var maxValueFound = 0.0;
            var maxPosition = 0;`:`var resultValue = ${"avg"===this.poolType?"0.0":"-1.0 / pow(10.0, -20.0)"};`}

          var count = 0.0;
          for (var wD = 0; wD < uniforms.filterDims.x; wD++) {
            let xD = xDCorner + wD;
            if (xD < 0 || xD >= uniforms.convDims.x) {
              continue;
            }

            for (var wR = 0; wR < uniforms.filterDims.y; wR++) {
              let xR = xRCorner + wR;
              if (xR < 0 || xR >= uniforms.convDims.y) {
                continue;
              }

              for (var wC = 0; wC < uniforms.filterDims.z; wC++) {
                let xC = xCCorner + wC;
                if (xC < 0 || xC >= uniforms.convDims.z) {
                  continue;
                }

                let value = getX(batch, xD, xR, xC, ch);
                ${e}
              }
            }
          }

          ${this.computePositions?"setOutputAtIndexI32(index, maxPosition);":`setOutputAtIndex(index, ${t});`}
        }
      }
    `}}function i3(e){let{inputs:t,backend:i,attrs:r}=e,{x:a}=t,{reductionIndices:s,keepDims:o}=r;return iB(a,s,o,"max",i)}let i4={kernelName:Y.Max,backendName:"webgpu",kernelFunc:i3};function i6(e){let{inputs:t,backend:i,attrs:r}=e,{x:a}=t,{keepDims:s,axis:o}=r;return iB(a,o,s,"mean",i)}let i5={kernelName:Y.Mean,backendName:"webgpu",kernelFunc:i6};function i8(e,t,i,r){let a;if(1===t.filterWidth&&1===t.filterHeight&&y.util.arraysEqual(t.inShape,t.outShape))return eJ({inputs:{x:e},backend:r});if(t.filterWidth===t.inWidth&&t.filterHeight===t.inHeight&&1===t.batchSize&&"VALID"===t.padInfo.type){let a,s=e.shape.length,o=eX({inputs:{x:e},backend:r,attrs:{shape:[e.shape[s-3]*e.shape[s-2],e.shape[s-1]]}});"avg"===i?a=i6({inputs:{x:o},backend:r,attrs:{axis:0,keepDims:!1}}):(y.util.assert("max"===i,()=>`Invalid pool type ${i}`),a=i3({inputs:{x:o},backend:r,attrs:{reductionIndices:0,keepDims:!1}}));let n=eX({inputs:{x:a},backend:r,attrs:{shape:t.outShape}});return r.disposeData(o.dataId),r.disposeData(a.dataId),n}let s=[{type:"int32",data:[t.strideHeight,t.strideWidth]}];return 1===t.filterHeight&&1===t.filterWidth?a=new i2(t):("avg"===i?a=new i0(t,"avg"):(y.util.assert("max"===i,()=>`Invalid pool type ${i}`),a=new i0(t,"max")),s.push({type:"int32",data:[t.padInfo.top,t.padInfo.left]},{type:"int32",data:[t.dilationHeight,t.dilationWidth]},{type:"int32",data:[t.inHeight,t.inWidth]},{type:"int32",data:[t.effectiveFilterHeight,t.effectiveFilterWidth]})),r.runWebGPUProgram(a,[e],e.dtype,s)}let i9={kernelName:Y.AvgPool,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a}=t,{filterSize:s,strides:o,pad:n,dimRoundingMode:u}=r,l=m.backend_util.computePool2DInfo(a.shape,s,o,1,n,u);return i8(a,l,"avg",i)}},i7={kernelName:Y.AvgPool3D,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a}=t,{filterSize:s,strides:o,pad:n,dataFormat:u,dimRoundingMode:l}=r,d=m.backend_util.computePool3DInfo(a.shape,s,o,[1,1,1],n,l,u),h=new i1(d,"avg"),p=[{type:"int32",data:[d.strideDepth,d.strideHeight,d.strideWidth]},{type:"int32",data:[d.padInfo.front,d.padInfo.top,d.padInfo.left]},{type:"int32",data:[d.inDepth,d.inHeight,d.inWidth]},{type:"int32",data:[d.effectiveFilterDepth,d.effectiveFilterHeight,d.effectiveFilterWidth]}];return i.runWebGPUProgram(h,[a],a.dtype,p)}};class re{constructor(e){this.variableNames=["dy"],this.uniforms=`strides : vec2<i32>, pads : vec2<i32>, dilations : vec2<i32>, filterDims : vec2<i32>,
       outHeight : i32, outWidth : i32, avgMultiplier : f32,`,this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e.inShape,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.shaderKey="avgPool2DBackprop"}getUserCode(){return`
      ${P("index")} {
      if (index < uniforms.size) {
        let coords = getCoordsFromIndex(index);
        let batch = coords[0];
        let d = coords[3];

        let dyRCCorner = vec2<i32>(coords.yz) - uniforms.pads;
        let dyRCorner = dyRCCorner.x;
        let dyCCorner = dyRCCorner.y;

        // Convolve dy(?, ?, d) with pos mask(:, :, d) to get dx(xR, xC, d).
        // ? = to be determined. : = across all values in that axis.
        var dotProd = 0.0;
        for (var wR = 0; wR < uniforms.filterDims[0]; wR = wR + uniforms.dilations[0]) {
          let dyR = f32(dyRCorner + wR) / f32(uniforms.strides[0]);

          if (dyR < 0.0 || dyR >= f32(uniforms.outHeight) || fract(dyR) > 0.0) {
            continue;
          }
          let idyR = i32(dyR);

          for (var wC = 0; wC < uniforms.filterDims[1]; wC = wC + uniforms.dilations[1]) {
            let dyC = f32(dyCCorner + wC) / f32(uniforms.strides[1]);

            if (dyC < 0.0 || dyC >= f32(uniforms.outWidth) || fract(dyC) > 0.0) {
              continue;
            }
            let idyC = i32(dyC);

            let dyValue = getDy(batch, idyR, idyC, d);

            dotProd = dotProd + dyValue * uniforms.avgMultiplier;
          }
        }
        setOutputAtIndex(index, dotProd);
      }
    }
    `}}class rt{constructor(e){this.variableNames=["dy"],this.uniforms=`strides : vec3<i32>, pads : vec3<i32>, filterDims : vec3<i32>,
       outDepth : i32, outHeight : i32, outWidth : i32, avgMultiplier : f32,`,this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e.inShape,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.shaderKey="avgPool3DBackprop"}getUserCode(){return`
      ${P("index")} {
      if (index < uniforms.size) {
        let coords = getCoordsFromIndex(index);
        let batch = coords.x;
        let ch = coords.u;

        let dyCorner = vec3<i32>(coords.y, coords.z, coords.w) - uniforms.pads;
        let dyDCorner = dyCorner.x;
        let dyRCorner = dyCorner.y;
        let dyCCorner = dyCorner.z;

        // Convolve dy(?, ?, ?, d) with pos mask(:, :, :, ch) to get
        // dx(xD, xR, xC, ch).
        // ? = to be determined. : = across all values in that axis.
        var dotProd = 0.0;
        for (var wD = 0; wD < uniforms.filterDims[0]; wD++) {
          let dyD = f32(dyDCorner + wD) / f32(uniforms.strides[0]);

          if (dyD < 0.0 || dyD >= f32(uniforms.outDepth) || fract(dyD) > 0.0) {
            continue;
          }
          let idyD = i32(dyD);

          for (var wR = 0; wR < uniforms.filterDims[1]; wR++) {
            let dyR = f32(dyRCorner + wR) / f32(uniforms.strides[1]);

            if (dyR < 0.0 || dyR >= f32(uniforms.outHeight) || fract(dyR) > 0.0) {
              continue;
            }
            let idyR = i32(dyR);

            for (var wC = 0; wC < uniforms.filterDims[2]; wC++) {
              let dyC = f32(dyCCorner + wC) / f32(uniforms.strides[2]);

              if (dyC < 0.0 || dyC >= f32(uniforms.outWidth) || fract(dyC) > 0.0) {
                continue;
              }
              let idyC = i32(dyC);

              let dyValue = getDy(batch, idyD, idyR, idyC, ch);
              dotProd += dyValue * uniforms.avgMultiplier;
            }
          }
        }
        setOutputAtIndex(index, dotProd);
      }
    }
    `}}let ri={kernelName:Y.AvgPool3DGrad,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{dy:a,input:s}=t,{filterSize:o,strides:n,pad:u,dimRoundingMode:l}=r,d=m.backend_util.computePool3DInfo(s.shape,o,n,1,u,l),h=new rt(d),p=1/(d.filterDepth*d.filterHeight*d.filterWidth),c=[{type:"int32",data:[d.strideDepth,d.strideHeight,d.strideWidth]},{type:"int32",data:[d.effectiveFilterDepth-1-d.padInfo.front,d.effectiveFilterHeight-1-d.padInfo.top,d.effectiveFilterWidth-1-d.padInfo.left]},{type:"int32",data:[d.effectiveFilterDepth,d.effectiveFilterHeight,d.effectiveFilterWidth]},{type:"int32",data:[d.outDepth]},{type:"int32",data:[d.outHeight]},{type:"int32",data:[d.outWidth]},{type:"float32",data:[p]}];return i.runWebGPUProgram(h,[a],s.dtype,c)}},rr={kernelName:Y.AvgPoolGrad,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{dy:a,input:s}=t;G([a,s],"avgPoolGrad");let{filterSize:o,strides:n,pad:u}=r,l=m.backend_util.computePool2DInfo(s.shape,o,n,1,u),d=new re(l),h=1/(l.filterHeight*l.filterWidth),p=[{type:"int32",data:[l.strideHeight,l.strideWidth]},{type:"int32",data:[l.effectiveFilterHeight-1-l.padInfo.top,l.effectiveFilterWidth-1-l.padInfo.left]},{type:"int32",data:[l.dilationHeight,l.dilationWidth]},{type:"int32",data:[l.effectiveFilterHeight,l.effectiveFilterWidth]},{type:"int32",data:[l.outHeight]},{type:"int32",data:[l.outWidth]},{type:"float32",data:[h]}];return i.runWebGPUProgram(d,[a],s.dtype,p)}},ra={kernelName:Y.BatchMatMul,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{a,b:s}=t,{transposeA:o,transposeB:n}=r;return eq({a,b:s,transposeA:o,transposeB:n,backend:i})}};var rs=e.i(752639);class ro{constructor(e,t){this.variableNames=["source"],this.workPerThread=1,this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=t,this.rank=t.length,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize,[this.workPerThread,1,1]),this.start=e,this.uniforms=`start : ${R(e.length)}, `,this.shaderKey="slice"}getUserCode(){let e,t=R(this.rank),i=function(e){if(1===e)return"sourceLoc";if(e<=6)return rn.slice(0,e).map(e=>`sourceLoc.${e}`).join(",");throw Error(`Slicing for rank ${e} is not yet supported`)}(this.rank);return e=1===this.start.length?this.outputShape.map((e,t)=>"sourceLoc = uniforms.start + coords;"):this.outputShape.map((e,t)=>`sourceLoc.${rn[t]} = uniforms.start.${$(t)} + coords.${rn[t]};`),`
      ${P("index")} {
        if (index < uniforms.size) {
          var sourceLoc : ${t};
          let coords = getCoordsFromIndex(index);
          ${e.join("\n")}
          setOutputAtIndex(index, getSource(${i}));
        }
      }
    `}}let rn=["x","y","z","w","u","v"];function ru(e){let{inputs:t,backend:i,attrs:r}=e,{x:a}=t,{begin:s,size:o}=r,[n,u]=rs.slice_util.parseSliceParams(a,s,o);if(rs.slice_util.assertParamsValid(a,n,u),i.shouldExecuteOnCPU([a])||"string"===a.dtype){let e=ip(i.tensorMap.get(a.dataId).values,n,u,a.shape,a.dtype);return i.makeTensorInfo(u,a.dtype,e)}if(0===y.util.sizeFromShape(u))return i.makeTensorInfo(u,a.dtype,[]);let l=new ro(n,u),d=[{type:"int32",data:n}];return i.runWebGPUProgram(l,[a],a.dtype,d)}let rl={kernelName:Y.Slice,backendName:"webgpu",kernelFunc:ru},rd={kernelName:Y.BatchToSpaceND,backendName:"webgpu",kernelFunc:e=>{let{inputs:t,backend:i,attrs:r}=e,{x:a}=t,{blockShape:s,crops:o}=r;y.util.assert(a.shape.length<=4,()=>"batchToSpaceND for rank > 4 with a WebGPU backend not implemented yet");let n=s.reduce((e,t)=>e*t),u=m.backend_util.getReshaped(a.shape,s,n),l=m.backend_util.getPermuted(u.length,s.length),d=m.backend_util.getReshapedPermuted(a.shape,s,n),h=m.backend_util.getSliceBeginCoords(o,s.length),p=m.backend_util.getSliceSize(d,o,s.length),c=[],f=eX({inputs:{x:a},backend:i,attrs:{shape:u}}),g=iF({inputs:{x:f},backend:i,attrs:{perm:l}}),x=eX({inputs:{x:g},backend:i,attrs:{shape:d}}),w=ru({inputs:{x:x},backend:i,attrs:{begin:h,size:p}});return c.push(f),c.push(g),c.push(x),c.forEach(e=>i.disposeData(e.dataId)),w}},rh=`
  fn bincount_write(index: i32, value: f32) {
    ${I("&result[index]","value","float32")}
  }
`,rp=`
  fn bincount_write(index: i32, value: f32) {
    atomicStore(&result[index], bitcast<i32>(value));
  }
`;class rc{constructor(e,t,i=!1){this.outputShape=[],this.variableNames=["x"],this.uniforms="binCountSize : i32,",this.workgroupSize=[64,1,1],this.atomic=!0,this.hasWeights=!0,this.binaryOutput=!1,this.outputShape=e,this.rank=e.length,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.binaryOutput=i,i&&(this.atomic=!1),this.hasWeights=t,this.hasWeights&&this.variableNames.push("w"),this.shaderKey=`bincount_${this.hasWeights}_${this.binaryOutput}_${this.rank}`}getUserCode(){return`
    ${this.binaryOutput?rp:rh}
  ${P("index")} {
    ${1===this.rank?`if (index < uniforms.xShape) {
      let indexVal = i32(getX(index));
      if (indexVal < uniforms.binCountSize) {
        let value = ${this.binaryOutput?1:this.hasWeights?"getW(index)":"1."};
        bincount_write(indexVal, value);
      }
    }`:`let coord = getCoordsFromIndex(index);
    if (coordsInBounds2D(coord, uniforms.xShape)) {
      let indexVal = i32(getX(coord[0], coord[1]));
      if (indexVal < uniforms.binCountSize) {
        let value = ${this.binaryOutput?1:this.hasWeights?"getW(coord[0], coord[1])":"1."};
        bincount_write(coord.x * uniforms.binCountSize + indexVal, value);
      }
    }`}
  }
  `}}let rf={kernelName:Y.Bincount,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a,weights:s}=t,{size:o}=r,n=y.util.sizeFromShape(a.shape),u=y.util.sizeFromShape(s.shape)>0,l=s.dtype,d=eG({backend:i,attrs:{shape:[o],value:0,dtype:l}}),h=new rc([n],u),p=[{type:"int32",data:[o]}],c=u?[a,s]:[a];return i.runWebGPUProgram(h,c,l,p,d)}};class rm{constructor(e){this.outputShape=[],this.variableNames=["s0","s1"],this.uniforms="s0Size : i32, s1Size : i32, ",this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=[e],this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.shaderKey="broadcastArgs"}getUserCode(){return`
  ${P("index")} {
    if (index < uniforms.size) {
      var s0 = 1.0;
      var s1 = 1.0;
      let indexS0 = index - uniforms.size + uniforms.s0Size;
      let indexS1 = index - uniforms.size + uniforms.s1Size;
      if (indexS0 >= 0) {
        s0 = getS0(indexS0);
      }
      if (indexS1 >= 0) {
        s1 = getS1(indexS1);
      }

      if (s0 == 1.0) {
        setOutputAtIndex(index, s1);
      } else if (s1 == 1.0) {
        setOutputAtIndex(index, s0);
      } else if (s0 != s1) {
        setOutputAtIndex(index, uniforms.NAN);
      } else {
        setOutputAtIndex(index, s0);
      }
    }
  }
  `}}let rg={kernelName:Y.BroadcastArgs,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i}=e,{s0:r,s1:a}=t;if(i.shouldExecuteOnCPU([r,a])){let e=i.tensorMap.get(r.dataId),t=i.tensorMap.get(a.dataId),s=e.values,o=t.values,n=m.backend_util.assertAndGetBroadcastShape(Array.from(s),Array.from(o));return i.makeTensorInfo([n.length],"int32",Int32Array.from(n))}let s=y.util.sizeFromShape(r.shape),o=y.util.sizeFromShape(a.shape),n=new rm(Math.max(s,o)),u=[{type:"int32",data:[s]},{type:"int32",data:[o]}];return i.runWebGPUProgram(n,[r,a],"int32",u)}};var rx=e.i(825754);let ry=e6({opType:l.NOT_EQUAL,dtype:"bool",cpuKernelImpl:is}),rw={kernelName:Y.NotEqual,backendName:"webgpu",kernelFunc:ry};function rb(e){let{inputs:t,backend:i}=e,{input:r}=t;return eJ({inputs:{x:i.tensorMap.get(r.dataId).complexTensorInfos.real},backend:i})}let rC={kernelName:Y.Real,backendName:"webgpu",kernelFunc:rb},rS={kernelName:Y.Cast,backendName:"webgpu",kernelFunc:function e(t){let{inputs:i,backend:r,attrs:a}=t,{x:s}=i,{dtype:o}=a;if("complex64"===o){if("complex64"===s.dtype)return eJ({inputs:{x:s},backend:r});let t=rx.zeros(s.shape),i=e({inputs:{x:s},backend:r,attrs:{dtype:"float32"}}),a=e0({inputs:{real:i,imag:t},backend:r});return t.dispose(),r.disposeData(i.dataId),a}if("complex64"===s.dtype){let t=rb({inputs:{input:s},backend:r}),i=e({inputs:{x:t},backend:r,attrs:{dtype:o}});return r.disposeData(t.dataId),i}if(!y.util.hasEncodingLoss(s.dtype,o)){let e=eJ({inputs:{x:s},backend:r});return{dataId:e.dataId,shape:e.shape,dtype:o}}if(r.shouldExecuteOnCPU([s])){let[e,t,i]=tY(r.tensorMap.get(s.dataId).values,s.shape,s.dtype,o);return r.makeTensorInfo(e,t,i)}if("int32"===o){let e,t;return e=new e3(s.shape,d.TO_INT),{dataId:(t=r.runWebGPUProgram(e,[s],"int32")).dataId,shape:t.shape,dtype:t.dtype}}if("bool"===o){let e=r.makeTensorInfo([],"bool",y.util.getTypedArrayFromDType("bool",1)),t=ry({inputs:{a:s,b:e},backend:r});return r.disposeData(e.dataId),t}throw Error(`Error in Cast: failed to cast ${s.dtype} to ${o}`)}},rv=e4({opType:d.CEIL,cpuKernelImpl:tj}),rI={kernelName:Y.Ceil,backendName:"webgpu",kernelFunc:rv};class rk{constructor(e){this.variableNames=["A"],this.uniforms="minVal : f32, maxVal : f32,",this.workPerThread=4,this.workgroupSize=[64,1,1],this.outputComponent=4,this.size=!0,this.outputShape=e,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize,[this.workPerThread,1,1]),this.shaderKey="clipVec4"}getUserCode(){return`
      ${P("index")} {
        if(index < uniforms.size) {
          let value = getAByOutputIndex(index);
          var clampedValue = clamp(
              value, vec4<f32>(uniforms.minVal), vec4<f32>(uniforms.maxVal));
          clampedValue = select(clampedValue, value, isnanVec4(value));
          setOutputAtIndex(index, clampedValue);
        }
      }
    `}}class rR{constructor(e){this.variableNames=["A"],this.uniforms="minVal : f32, maxVal : f32,",this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.shaderKey="clip"}getUserCode(){return`
      ${P("index")} {
        if(index < uniforms.size) {
          let value = getAByOutputIndex(index);
          if (isnan(value)) {
            setOutputAtIndex(index, value);
            return;
          }
          setOutputAtIndex(index, clamp(value, uniforms.minVal, uniforms.maxVal));
        }
      }
    `}}let r$={kernelName:Y.ClipByValue,backendName:"webgpu",kernelFunc:function(e){let t,{inputs:i,backend:r,attrs:a}=e,{x:s}=i,{clipValueMin:o,clipValueMax:n}=a;return t=y.util.sizeFromShape(s.shape)%4==0?new rk(s.shape):new rR(s.shape),r.runWebGPUProgram(t,[s],s.dtype,[{type:"float32",data:[o]},{type:"float32",data:[n]}])}};class rP{constructor(e){this.outputShape=[],this.variableNames=["real","imag"],this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.shaderKey="complexAbs"}getUserCode(){return`
    ${P("index")} {
      if (index < uniforms.size) {
        let re = abs(getRealByOutputIndex(index));
        let im = abs(getImagByOutputIndex(index));
        let mx = max(re, im);

        // The length function in wgsl may be not underflow-safe on some GPUs.
        // So the safe solution is to ensure underflow-safety in all cases.
        setOutputAtIndex(index, select(mx * length(vec2<f32>(1, min(re, im)/mx)), 0.0, mx == 0.0));
      }
    }
  `}}function rz(e,t){return{dataId:t.dataId,dtype:t.dtype,shape:e.shape}}let rA={kernelName:Y.ComplexAbs,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i}=e,{x:r}=t,a=i.tensorMap.get(r.dataId),s=new rP(r.shape),o=[rz(r,a.complexTensorInfos.real),rz(r,a.complexTensorInfos.imag)];return i.runWebGPUProgram(s,o,o[0].dtype)}};class rN{constructor(e){this.uniforms="",this.workPerThread=1,this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=m.backend_util.computeOutShape(e,1),this.variableNames=e.map((e,t)=>`T${t}`),this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize,[this.workPerThread,1,1]),this.offsetLength=e.length-1;for(let e=0;e<this.offsetLength;e++)this.uniforms+=`offset${e} : i32,`;this.shaderKey="concat"}getUserCode(){let e=[];if(this.offsetLength>0){e.push("if (yC < uniforms.offset0){ setOutputAtCoords(coords.x, coords.y, getT0(yR, yC)); }");for(let t=1;t<this.offsetLength;t++)e.push(`else if (yC < uniforms.offset${[t]}){ setOutputAtCoords(coords.x, coords.y, getT${t}(yR, yC - uniforms.offset${t-1})); }`);let t=this.offsetLength,i=this.offsetLength-1;e.push(`else { setOutputAtCoords(coords.x, coords.y, getT${t}(yR, yC - uniforms.offset${i})); }`)}else e.push("setOutputAtCoords(coords.x, coords.y, getT0(yR, yC));");return`
      ${P("index")} {
        for(var i = 0; i < ${this.workPerThread}; i = i + 1) {
          let flatIndex = index * ${this.workPerThread} + i;
          if(flatIndex < uniforms.size) {
            let coords = getCoordsFromIndex(flatIndex);
            let yR = coords.x;
            let yC = coords.y;

            ${e.join("\n        ")}
          }
        }
      }
    `}}function rD(e){let{inputs:t,backend:i}=e,{input:r}=t;return eJ({inputs:{x:i.tensorMap.get(r.dataId).complexTensorInfos.imag},backend:i})}let rT={kernelName:Y.Imag,backendName:"webgpu",kernelFunc:rD};function rF(e){let{inputs:t,backend:i,attrs:r}=e,{axis:a}=r,s=y.util.parseAxisParam(a,t[0].shape)[0],o=t.map(e=>e.shape);m.backend_util.assertParamsConsistent(o,s);let n=m.backend_util.computeOutShape(t.map(e=>e.shape),s);if(0===y.util.sizeFromShape(n))return i.makeTensorInfo(n,t[0].dtype,[]);let u=t.filter(e=>y.util.sizeFromShape(e.shape)>0);return 1===u.length?eJ({inputs:{x:u[0]},backend:i}):function e(t,i,r){var a,s,o;let n,u=t[0].dtype;if("complex64"===u){let a=t.map(e=>rb({inputs:{input:e},backend:r})),s=t.map(e=>rD({inputs:{input:e},backend:r})),o=e(a,i,r),n=e(s,i,r),u=e0({inputs:{real:o,imag:n},backend:r});return a.forEach(e=>r.disposeData(e.dataId)),s.forEach(e=>r.disposeData(e.dataId)),r.disposeData(o.dataId),r.disposeData(n.dataId),u}let l=r.shouldExecuteOnCPU(t);if("string"===u&&(l=!0),l){let e=t.map(e=>{let t=y.util.sizeFromShape(e.shape.slice(i));return eX({inputs:{x:e},backend:r,attrs:{shape:[-1,t]}})}),a=tQ(e.map(e=>({vals:r.readSync(e.dataId),shape:e.shape})),m.backend_util.computeOutShape(e.map(e=>e.shape),1),u,1===e[0].shape[0]),s=m.backend_util.computeOutShape(t.map(e=>e.shape),i),o=r.makeTensorInfo(s,u,a);return e.forEach(e=>r.disposeData(e.dataId)),o}let d=r.device.limits.maxStorageBuffersPerShaderStage-1;if(t.length>d){let a=[];for(let s=0;s<t.length;s+=d){let o=t.slice(s,s+d);a.push(e(o,i,r))}let s=e(a,i,r);for(let e of a)r.disposeData(e.dataId);return s}let{tensors2D:h,outShape:p}=(a=t,s=i,o=r,n=m.backend_util.computeOutShape(a.map(e=>e.shape),s),{tensors2D:a.map(e=>eX({inputs:{x:e},backend:o,attrs:{shape:[y.util.sizeFromShape(e.shape.slice(0,s)),y.util.sizeFromShape(e.shape.slice(s))]}})),outShape:n}),c=h.map(e=>e.shape),f=new rN(c),g=[],x=Array(c.length-1);if(x.length>0){x[0]=c[0][1],g.push({type:"int32",data:[x[0]]});for(let e=1;e<x.length;e++)x[e]=x[e-1]+c[e][1],g.push({type:"int32",data:[x[e]]})}let w=r.runWebGPUProgram(f,h,h[0].dtype,g);h.forEach(e=>r.disposeData(e.dataId));let b=eX({inputs:{x:w},backend:r,attrs:{shape:p}});return r.disposeData(w.dataId),b}(u,s,i)}let r_={kernelName:Y.Concat,backendName:"webgpu",kernelFunc:rF};class rE{constructor(e,t,i,r,a=!1,s=null,o=!1,n=!1){this.variableNames=["x","W"],this.uniforms="filterDims : vec2<i32>, pads : vec2<i32>, strides : vec2<i32>, dilations : vec2<i32>, dimAOuter : i32, dimBOuter : i32, dimInner : i32,",this.outputShape=e.outShape,this.isChannelsLast="channelsLast"===e.dataFormat,this.isVec4=((e.inChannels%4==0||e.inChannels%3==0)&&this.isChannelsLast||e.outWidth%4==0&&!this.isChannelsLast)&&e.outChannels%4==0,this.dispatchLayout=this.isChannelsLast?{x:[3],y:[1,2],z:[0]}:{x:[2,3],y:[1],z:[0]},this.workgroupSize=W(this.dispatchLayout,this.outputShape,this.isVec4),this.elementsPerThread=O(this.dispatchLayout,this.outputShape,this.isVec4),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize,this.elementsPerThread),this.isVec4?(this.outputComponent=4,this.isChannelsLast&&e.inChannels%4!=0?(this.innerElementSize=3,this.variableComponents=[1,4]):(this.innerElementSize=4,this.variableComponents=[4,4]),a&&(this.variableNames.push("bias"),this.variableComponents.push(4)),o&&(this.variableNames.push("preluActivationWeights"),this.variableComponents.push(4))):(this.innerElementSize=this.elementsPerThread[0],a&&this.variableNames.push("bias"),o&&this.variableNames.push("preluActivationWeights")),this.sequentialAccessByThreads=n,this.addBias=a,this.activation=s,this.hasPreluActivationWeights=o,this.tileAOuter=this.workgroupSize[1]*this.elementsPerThread[1],this.tileBOuter=this.workgroupSize[0]*this.elementsPerThread[0],this.tileInner=Math.max(this.workgroupSize[0]*this.innerElementSize,this.workgroupSize[1]),this.fitAOuter=t%this.tileAOuter==0,this.fitBOuter=i%this.tileBOuter==0,this.fitInner=r%this.tileInner==0,this.shaderKey=`conv2DMM_${this.elementsPerThread}_${this.activation}}_${this.fitAOuter}_${this.fitBOuter}_${this.fitInner}_${this.isVec4}_${this.innerElementSize}_${this.isChannelsLast}_${this.sequentialAccessByThreads}`}getUserCode(){let e=this.isVec4?e_(this.elementsPerThread,this.workgroupSize,!this.isChannelsLast,this.tileInner):eL(this.elementsPerThread,this.workgroupSize,!this.isChannelsLast,this.tileInner,!1,null,this.sequentialAccessByThreads),t=this.isVec4?[this.innerElementSize,4,4]:[1,1,1];return`
    ${function(e,t,i,r,a=!1,s=null,o=!1,n=4,u=4,l=4){let d=e?`
      let coord = vec4<i32>(batch, xRow, xCol, xCh);
      `:`
      let coord = vec4<i32>(batch, xCh, xRow, xCol);
      `,h=e?`
      let coords = vec4<i32>(
        batch,
        row / outWidth,
        row % outWidth,
        col);
      `:`
      let coords = vec4<i32>(
        batch,
        row,
        col / outWidth,
        col % outWidth);
      `,p=e?"row":"col",c=e?"col":"row",f=`
      let inChannels = uniforms.wShape[2];
      let outWidth = ${e?"uniforms.outShape[2]":"uniforms.outShape[3]"};
      let outRow = ${p} / outWidth;
      let outCol = ${p} % outWidth;

      let WRow = ${c} / (uniforms.filterDims[1] * inChannels);
      let WCol = ${c} / inChannels % uniforms.filterDims[1];
      let xRow = outRow * uniforms.strides[0] + uniforms.dilations[0] * WRow - uniforms.pads[0];
      let xCol = outCol * uniforms.strides[1] + uniforms.dilations[1] * WCol - uniforms.pads[1];
      let xCh = ${c} % inChannels;
      var resData = ${k(n)}(0.0);
      // The bounds checking is always needed since we use it to pad zero for
      // the 'same' padding type.
      if (xRow >= 0 && xRow < ${e?"uniforms.xShape[1]":"uniforms.xShape[2]"} && xCol >= 0 && xCol < ${e?"uniforms.xShape[2]":"uniforms.xShape[3]"}) {
        ${d}
        let xIndex = getIndexFromCoords4D(coord, uniforms.xShape);
        ${(e=>{switch(e){case 1:return"resData = f32(x[xIndex]);";case 3:return"resData = vec3<f32>(x[xIndex], x[xIndex + 1], x[xIndex + 2]);";case 4:return"resData = vec4<f32>(x[xIndex / 4]);";default:throw Error(`innerElementSize ${e} is not supported.`)}})(n)}
      }
      return resData;`,m=e?t&&r?`
      ${f}`:`
      if (row < uniforms.dimAOuter && col < uniforms.dimInner) {
        ${f}
      }
      return ${k(n)}(0.0);`:r&&i?`
      ${f}`:`
      if (row < uniforms.dimInner && col < uniforms.dimBOuter) {
        ${f}
      }
      return ${k(n)}(0.0);`,g=`${(e=>{switch(e){case 1:return"return f32(W[row * uniforms.wShape[3] + col]);";case 4:return"return vec4<f32>(W[(row * uniforms.wShape[3] + col) / 4]);";default:throw Error(`innerElementSize ${e} is not supported.`)}})(u)}`,x=k(l),y=e?k(n):k(u),w=e?k(u):k(n);return`
      ${eN(s,o,4===l,4)}
      fn mm_readA(batch: i32, row : i32, col : i32) -> ${y} {
        ${e?m:g}
      }

      fn mm_readB(batch: i32, row : i32, col : i32) -> ${w} {
        ${e?g:m}
      }

      fn mm_write(batch: i32, row : i32, col : i32, valueIn : ${x}) {
        if (row < uniforms.dimAOuter && col < uniforms.dimBOuter)
        {
        var value = valueIn;
        let outWidth = ${e?"uniforms.outShape[2]":"uniforms.outShape[3]"};
        ${h}
        ${eD(a,s)}
        setOutputAtCoords(coords[0], coords[1], coords[2], coords[3], value);
        }
      }`}(this.isChannelsLast,this.fitAOuter,this.fitBOuter,this.fitInner,this.addBias,this.activation,this.hasPreluActivationWeights,t[0],t[1],t[2])}
    ${e}
  `}}class rL{constructor(e,t=!1,i=null,r=!1){this.variableNames=["x","W"],this.uniforms="filterDims: vec2<i32>, pads: vec2<i32>, strides: vec2<i32>, dilations: vec2<i32>,",this.workgroupSize=[4,4,8],this.outputShape=e.outShape,this.isChannelsLast="channelsLast"===e.dataFormat,this.dispatchLayout=this.isChannelsLast?{x:[2],y:[1],z:[0,3]}:{x:[3],y:[2],z:[0,1]},this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.addBias=t,this.activation=i,this.hasPreluActivationWeights=r,t&&this.variableNames.push("bias"),r&&this.variableNames.push("preluActivationWeights"),this.shaderKey=`conv2dnaive_${this.activation}_${this.isChannelsLast}`}getUserCode(){return`
       ${eN(this.activation,this.hasPreluActivationWeights,!1,4)}
       fn readInp(batch : i32, row : i32, col : i32, chan : i32) -> f32{
         let coords = vec4<i32>(batch, row, col, chan);
         if (coordsInBounds4D(coords, uniforms.xShape)) {
           return  getX(batch, row, col, chan);
         } else {
          return 0.0;
         }
       }
       fn readFilt(row : i32, col : i32, xChannel : i32, outChannel : i32) -> f32{
         let coords = vec4<i32>(row, col, xChannel, outChannel);
         if(coordsInBounds4D(coords, uniforms.wShape)) {
           return getW(row, col, xChannel, outChannel);
          } else {
            return 0.0;
          }
       }
       fn writeResult(batch : i32, row : i32, col : i32, chan : i32, valueIn : f32) {
         let coords = ${this.isChannelsLast?"vec4<i32>(batch, row, col, chan);":"vec4<i32>(batch, chan, row, col);"}
         if (coordsInBounds4D(coords, uniforms.outShape)) {
           var value = valueIn;
           ${eD(this.addBias,this.activation)}
           setOutputAtCoords(coords.x, coords.y, coords.z, coords.w, value);
         }
       }
       ${P("index")} {
         let coords = getOutputCoords();
         let batch = coords[0];
         let outChannel = ${this.isChannelsLast?"coords[3];":"coords[1];"}
         let outRow = ${this.isChannelsLast?"coords[1];":"coords[2];"}
         let outCol = ${this.isChannelsLast?"coords[2];":"coords[3];"}
         var acc : f32 = 0.0;
         for (var row = 0; row < uniforms.filterDims[0]; row = row + 1) {
           for (var col = 0; col < uniforms.filterDims[1]; col = col + 1) {
             let xRow = outRow * uniforms.strides[0] + uniforms.dilations[0] * row - uniforms.pads[0];
             let xCol = outCol * uniforms.strides[1] + uniforms.dilations[1] * col - uniforms.pads[1];
             for (var xChannel = 0; xChannel < ${this.isChannelsLast?"uniforms.xShape[3];":"uniforms.xShape[1];"} xChannel = xChannel + 1) {
               ${this.isChannelsLast?"let v = readInp(batch, xRow, xCol, xChannel);":"let v = readInp(batch, xChannel, xRow, xCol);"}
               let f = readFilt(row, col, xChannel, outChannel);
               acc = acc + v * f;
             }
           }
         }
         writeResult(batch, outRow, outCol, outChannel, acc);
       }
     `}}class rB{constructor(e,t){this.variableNames=["x"],this.uniforms=`pads : vec2<i32>, strides : vec2<i32>, dilations : vec2<i32>, outWidth : i32, itemsPerBlockRow : i32,
       inChannels : i32,`,this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.isChannelsLast=t,this.shaderKey=`im2col_${this.isChannelsLast}`}getUserCode(){let e=this.isChannelsLast?1:2,t=this.isChannelsLast?2:3,i=this.isChannelsLast?"coords[1]":"coords[2]",r=this.isChannelsLast?"coords[2]":"coords[1]",a=this.isChannelsLast?"getX(batch, xRow, xCol, ch)":"getX(batch, ch, xRow, xCol)";return`
    ${P("index")} {
      let coords = getCoordsFromIndex(index);
      if(index < uniforms.size) {
        let batch = coords[0];
        let row = ${i};
        let col = ${r};
        let offsetY = (row / uniforms.outWidth) * uniforms.strides[0] - uniforms.pads[0];
        let xRow = offsetY + uniforms.dilations[0] * (col / uniforms.itemsPerBlockRow);
        var value = 0.0;
        if(xRow < uniforms.xShape[${e}] && xRow >= 0) {
          let offsetX = (row % uniforms.outWidth) * uniforms.strides[1] -
              uniforms.pads[1];
          let xCol = offsetX + uniforms.dilations[1] * ((col %
              uniforms.itemsPerBlockRow) / uniforms.inChannels);
          let ch = col % uniforms.inChannels;
          if(xCol < uniforms.xShape[${t}] && xCol >= 0) {
            value = ${a};
          }
        }
        setOutputAtIndex(index, value);
      }
    }
   `}}function rW(e,t){let i=e.length;return i>=3?t?[...e.slice(0,-3),e[i-3]*e[i-2],e[i-1]]:[...e.slice(0,-3),e[i-3],e[i-2]*e[i-1]]:!t&&1===i&&e[0]>1?[e[0],1]:null}function rO({x:e,filter:t,convInfo:i,backend:r,bias:a=null,preluActivationWeights:s=null,leakyreluAlpha:o=0,activation:n=null}){let u,l=null!=a,d=null!=s,h="channelsLast"===i.dataFormat,c=h&&i.filterHeight===i.inHeight&&i.filterWidth===i.inWidth&&"VALID"===i.padInfo.type,f=(0,p.env)().getBool("WEBGPU_USE_NAIVE_CONV2D_DEBUG");if(!f&&(c||1===i.filterHeight&&1===i.filterWidth&&1===i.dilationHeight&&1===i.dilationWidth&&1===i.strideHeight&&1===i.strideWidth&&("SAME"===i.padInfo.type||"VALID"===i.padInfo.type)))return function({x:e,filter:t,convInfo:i,backend:r,bias:a=null,preluActivationWeights:s=null,leakyreluAlpha:o=0,activation:n=null}){let u,l,d="channelsLast"===i.dataFormat,h=d&&i.filterHeight===i.inHeight&&i.filterWidth===i.inWidth&&"VALID"===i.padInfo.type,p=[];if(h){let a=i.inHeight*i.inWidth*i.inChannels;u=eX({inputs:{x:e},backend:r,attrs:{shape:[1,i.batchSize,a]}}),l=eX({inputs:{x:t},backend:r,attrs:{shape:[1,a,i.outChannels]}})}else u=eX({inputs:{x:e},backend:r,attrs:{shape:d?[i.batchSize,i.inHeight*i.inWidth,i.inChannels]:[i.batchSize,i.inChannels,i.inHeight*i.inWidth]}}),l=eX({inputs:{x:t},backend:r,attrs:{shape:[1,i.inChannels,i.outChannels]}});if(p.push(u),p.push(l),null!=s){let e=rW(s.shape,d);null!=e&&(s=eX({inputs:{x:s},backend:r,attrs:{shape:e}}),p.push(s))}if(null!=a){let e=rW(a.shape,d);null!=e&&(a=eX({inputs:{x:a},backend:r,attrs:{shape:e}}),p.push(a))}let c=eq({a:d?u:l,b:d?l:u,transposeA:!d,transposeB:!1,backend:r,bias:a,activation:n,preluActivationWeights:s,leakyreluAlpha:o}),f=eX({inputs:{x:c},backend:r,attrs:{shape:i.outShape}});for(let e of(p.push(c),p))r.disposeData(e.dataId);return f}({x:e,filter:t,convInfo:i,backend:r,bias:a,activation:n,preluActivationWeights:s,leakyreluAlpha:o});let m=(0,p.env)().getNumber("WEBGPU_THRESHOLD_TO_INCREASE_WORKGROUPS_FOR_MATMUL"),g=m>-1?m:r.thresholdToIncreaseWorkgroups,x=i.batchSize*Math.ceil(i.outHeight*i.outWidth/32)*Math.ceil(i.outChannels/32);if((0,p.env)().getBool("WEBGPU_CONV_SEPARATE_IM2COL_SHADER")||x<=g)return function({x:e,filter:t,convInfo:i,backend:r,bias:a=null,preluActivationWeights:s=null,leakyreluAlpha:o=0,activation:n=null}){let{filterWidth:u,filterHeight:l,inChannels:d,strideWidth:h,strideHeight:p,padInfo:c,outWidth:f,outHeight:m,dilationWidth:g,dilationHeight:x,dataFormat:y}=i,w="channelsLast"===y,b=u*l*d,C=m*f,S=new rB(w?[i.batchSize,C,b]:[i.batchSize,b,C],w),v=[{type:"int32",data:[c.top,c.left]},{type:"int32",data:[p,h]},{type:"int32",data:[x,g]},{type:"int32",data:[f]},{type:"int32",data:[d*u]},{type:"int32",data:[d]}],I=r.runWebGPUProgram(S,[e],e.dtype,v),k=[];k.push(I);let R=eX({inputs:{x:t},backend:r,attrs:{shape:[1,b,-1]}});if(k.push(R),null!=s){let e=rW(s.shape,w);null!=e&&(s=eX({inputs:{x:s},backend:r,attrs:{shape:e}}),k.push(s))}if(null!=a){let e=rW(a.shape,w);null!=e&&(a=eX({inputs:{x:a},backend:r,attrs:{shape:e}}),k.push(a))}let $=eq({a:w?I:R,b:w?R:I,transposeA:!w,transposeB:!1,backend:r,bias:a,activation:n,preluActivationWeights:s,leakyreluAlpha:o}),P=eX({inputs:{x:$},backend:r,attrs:{shape:i.outShape}});for(let e of(k.push($),k))r.disposeData(e.dataId);return P}({x:e,filter:t,convInfo:i,backend:r,bias:a,preluActivationWeights:s,leakyreluAlpha:o,activation:n});let y=[i.padInfo.top,i.padInfo.left],w=[{type:"int32",data:[i.filterHeight,i.filterWidth]},{type:"int32",data:[...y]},{type:"int32",data:[i.strideHeight,i.strideWidth]},{type:"int32",data:[i.dilationHeight,i.dilationWidth]}];if(f)u=new rL(i,l,n,d);else{let e=h?i.outHeight*i.outWidth:i.outChannels,t=h?i.outChannels:i.outHeight*i.outWidth,a=i.filterHeight*i.filterWidth*i.inChannels;w.push({type:"int32",data:[e]},{type:"int32",data:[t]},{type:"int32",data:[a]}),u=new rE(i,e,t,a,l,n,d,r.adapterInfo.isIntel())}let b=[],C=[e,t];l&&(h||1!==a.shape.length||b.push(a=eX({inputs:{x:a},backend:r,attrs:{shape:[a.shape[0],1,1]}})),C.push(a)),d&&(h||1!==s.shape.length||b.push(s=eX({inputs:{x:s},backend:r,attrs:{shape:[s.shape[0],1,1]}})),C.push(s)),"leakyrelu"===n&&(w.push({type:"float32",data:[o]}),u.uniforms+=" alpha : f32,");let S=r.runWebGPUProgram(u,C,e.dtype,w);for(let e of b)r.disposeData(e.dataId);return S}let rU={kernelName:Y.Conv2D,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,attrs:i,backend:r}=e,{x:a,filter:s}=t,{strides:o,pad:n,dataFormat:u,dilations:l,dimRoundingMode:d}=i,h=m.backend_util.convertConv2DDataFormat(u),p=m.backend_util.computeConv2DInfo(a.shape,s.shape,o,l,n,d,!1,h);return rO({x:a,filter:s,convInfo:p,backend:r})}};class rM{constructor(e){this.variableNames=["dy","W"],this.uniforms="filterDims : vec2<i32>, pads : vec2<i32>, strides : vec2<i32>, outBackprop : vec4<i32>,",this.workgroupSize=[64,1,1],this.size=!1,this.isVec4=!1,this.workPerThread=1,this.outputShape=e.inShape,this.isChannelsLast="channelsLast"===e.dataFormat,this.isVec4=this.isChannelsLast&&e.outChannels%4==0&&e.inChannels%4==0,this.isVec4?(this.workPerThread=2,this.outputComponent=4,this.workgroupSize=[4,4,4],this.dispatchLayout={x:[3],y:[2],z:[0,1]},this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize,[4,this.workPerThread,1])):(this.size=!0,this.workPerThread=1,this.workgroupSize=[64,1,1],this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize)),this.shaderKey=`conv2DDerInput_${this.isChannelsLast}_${this.isVec4}_${this.workPerThread}`}getUserCode(){let e=this.isChannelsLast?1:2,t=this.isChannelsLast?2:3,i=this.isChannelsLast?3:1,r=`
    ${P()} {
      let batch = i32(globalId.z) / uniforms.outShape[1];
      let r = i32(globalId.z) % uniforms.outShape[1];
      let c = i32(globalId.y) * ${this.workPerThread};
      let d1 = i32(globalId.x) * 4;

      let dyCorner = vec2<i32>(r, c) - uniforms.pads;

      // Convolve dy(?, ?, d2) with w(:, :, d1, d2) to compute dx(xR, xC, d1).
      // ? = to be determined. : = across all values in that axis.
      var dotProd: array<vec4<f32>, ${this.workPerThread}>;
      for (var i = 0; i < ${this.workPerThread}; i++) {
        dotProd[i] = vec4<f32>(0.0);
      }
      for (var wR = 0; wR < uniforms.filterDims.x; wR = wR + 1) {
        let dyR = f32(dyCorner.x + wR) / f32(uniforms.strides.x);
        let wRPerm = uniforms.filterDims.x - 1 - wR;
        if (dyR < 0.0 || dyR >= f32(uniforms.outBackprop[1]) ||
            fract(dyR) > 0.0) {
          continue;
        }
        let idyR = i32(dyR);

        for (var wC = 0; wC < uniforms.filterDims.y; wC = wC + 1) {
          let dyC = f32(dyCorner.y + wC) / f32(uniforms.strides.y);
          let dyC2 = f32(dyCorner.y + 1 + wC) / f32(uniforms.strides.y);
          let wCPerm = uniforms.filterDims.y - 1 - wC;
          var bDyCVal = true;
          var bDyCVal2 = true;
          if (dyC < 0.0 || dyC >= f32(uniforms.outBackprop[2]) ||
              fract(dyC) > 0.0) {
            bDyCVal = false;
          }
          if (dyC2 < 0.0 || dyC2 >= f32(uniforms.outBackprop[2]) ||
              fract(dyC2) > 0.0) {
            bDyCVal2 = false;
          }

          let idyC = i32(dyC);
          let idyC2 = i32(dyC2);
          if (bDyCVal && bDyCVal2) {
            let d2Length = uniforms.outBackprop[3];
            for (var d2 = 0; d2 < d2Length; d2 = d2 + 4) {
              let wValue0 = getW(wRPerm, wCPerm, d1, d2);
              let wValue1 = getW(wRPerm, wCPerm, d1 + 1, d2);
              let wValue2 = getW(wRPerm, wCPerm, d1 + 2, d2);
              let wValue3 = getW(wRPerm, wCPerm, d1 + 3, d2);
              var xValue =  getDy(batch, idyR, idyC, d2);
              let tmpval = vec4<f32>(dot(xValue, wValue0),
                                     dot(xValue, wValue1),
                                     dot(xValue, wValue2),
                                     dot(xValue, wValue3));
              dotProd[0] = dotProd[0] + tmpval;
              xValue = getDy(batch, idyR, idyC2, d2);
              dotProd[1] = dotProd[1] + vec4<f32>(dot(xValue, wValue0),
                                                  dot(xValue, wValue1),
                                                  dot(xValue, wValue2),
                                                  dot(xValue, wValue3));
            }
          } else if (bDyCVal) {
            let d2Length = uniforms.outBackprop[3];
            for (var d2 = 0; d2 < d2Length; d2 = d2 + 4) {
              let wValue0 = getW(wRPerm, wCPerm, d1, d2);
              let wValue1 = getW(wRPerm, wCPerm, d1 + 1, d2);
              let wValue2 = getW(wRPerm, wCPerm, d1 + 2, d2);
              let wValue3 = getW(wRPerm, wCPerm, d1 + 3, d2);
              var xValue =  getDy(batch, idyR, idyC, d2);
              let tmpval = vec4<f32>(dot(xValue, wValue0),
                                     dot(xValue, wValue1),
                                     dot(xValue, wValue2),
                                     dot(xValue, wValue3));
              dotProd[0] = dotProd[0] + tmpval;
            }
          } else if (bDyCVal2) {
            let d2Length = uniforms.outBackprop[3];
            for (var d2 = 0; d2 < d2Length; d2 = d2 + 4) {
              let wValue0 = getW(wRPerm, wCPerm, d1, d2);
              let wValue1 = getW(wRPerm, wCPerm, d1 + 1, d2);
              let wValue2 = getW(wRPerm, wCPerm, d1 + 2, d2);
              let wValue3 = getW(wRPerm, wCPerm, d1 + 3, d2);
              var xValue =  getDy(batch, idyR, idyC2, d2);
              let tmpval = vec4<f32>(dot(xValue, wValue0),
                                     dot(xValue, wValue1),
                                     dot(xValue, wValue2),
                                     dot(xValue, wValue3));
              dotProd[1] = dotProd[1] + tmpval;
            }
          }
        }
      }

      for (var i = 0; i < ${this.workPerThread}; i = i + 1) {
        let coords = vec4<i32>(batch, r, c + i, d1);
        if (coordsInBounds4D(coords, uniforms.outShape)) {
          setOutputAtCoords(coords[0], coords[1], coords[2], coords[3], dotProd[i]);
        }
      }
    }
    `;return this.isVec4?`
    ${r}
    `:`
    ${P("index")} {
      if(index < uniforms.size) {
        let coords = getCoordsFromIndex(index);
        let batch = coords[0];
        let d1 = coords[${i}];

        let dyCorner = vec2<i32>(coords[${e}], coords[${t}]) - uniforms.pads;
        let dyRCorner = dyCorner.x;
        let dyCCorner = dyCorner.y;

        // Convolve dy(?, ?, d2) with w(:, :, d1, d2) to compute dx(xR, xC, d1).
        // ? = to be determined. : = across all values in that axis.
        var dotProd = 0.0;
        for (var wR = 0; wR < uniforms.filterDims.x; wR = wR + 1) {
          let dyR = (f32(dyRCorner) + f32(wR)) / f32(uniforms.strides.x);
          let wRPerm = uniforms.filterDims.x - 1 - wR;
          if (dyR < 0.0 || dyR >= f32(uniforms.outBackprop[1]) || fract(dyR) > 0.0 ||
              wRPerm < 0) {
            continue;
          }
          let idyR = i32(dyR);

          for (var wC = 0; wC < uniforms.filterDims.y; wC = wC + 1) {
            let dyC = (f32(dyCCorner) + f32(wC)) / f32(uniforms.strides.y);
            let wCPerm = uniforms.filterDims.y - 1 - wC;
            if (dyC < 0.0 || dyC >= f32(uniforms.outBackprop[2]) ||
                fract(dyC) > 0.0 || wCPerm < 0) {
              continue;
            }
            let idyC = i32(dyC);

            for (var d2 = 0; d2 < uniforms.outBackprop[3]; d2 = d2 + 1) {
              let xValue = ${this.isChannelsLast?"getDy(batch, idyR, idyC, d2)":"getDy(batch, d2, idyR, idyC)"};
              let wValue = getW(wRPerm, wCPerm, d1, d2);
              dotProd = dotProd + xValue * wValue;
            }
          }
        }
        setOutputAtIndex(index, dotProd);
      }
    }
  `}}class rV{constructor(e){this.variableNames=["x","dy"],this.uniforms="pads : vec2<i32>, strides : vec2<i32>, batchSize : i32, outHeight : i32, outWidth : i32, inHeight : i32, inWidth : i32,",this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e.filterShape,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.isChannelsLast="channelsLast"===e.dataFormat,this.shaderKey=`conv2DDerFilter_${this.isChannelsLast}`}getUserCode(){return`
    ${P("index")} {
      if(index < uniforms.size) {
        let coords = getCoordsFromIndex(index);
        let wR = coords[0];
        let wC = coords[1];
        let d1 = coords[2];
        let d2 = coords[3];

        // Convolve x(?, ?, d1) with dy(:, :, d2) to get dw(wR, wC, d1, d2).
        // ? = to be determined. : = across all values in that axis.
        var dotProd = 0.0;
        for (var b = 0; b < uniforms.batchSize; b = b + 1) {
          for (var yR = 0; yR < uniforms.outHeight; yR = yR + 1) {
            let xR = wR + yR * uniforms.strides[0] - uniforms.pads[0];
            if (xR < 0 || xR >= uniforms.inHeight) {
              continue;
            }

            for (var yC = 0; yC < uniforms.outWidth; yC = yC + 1) {
              let xC = wC + yC * uniforms.strides[1] - uniforms.pads[1];

              if (xC < 0 || xC >= uniforms.inWidth) {
                continue;
              }

              if (${this.isChannelsLast}) {
                let dyValue = getDy(b, yR, yC, d2);
                let xValue = getX(b, xR, xC, d1);
                dotProd = dotProd + xValue * dyValue;
              } else {
                let dyValue = getDy(b, d2, yR, yC);
                let xValue = getX(b, d1, xR, xC);
                dotProd = dotProd + xValue * dyValue;
              }
            }
          }
        }
        setOutputAtIndex(index, dotProd);
      }
    }
  `}}class rG{constructor(e){this.variableNames=["x","dy"],this.uniforms=`pads : vec3<i32>, strides : vec3<i32>, batchSize : i32, outDepth : i32,
       outHeight : i32, outWidth : i32, inDepth : i32, inHeight : i32, inWidth : i32,`,this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e.filterShape,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.shaderKey="conv3DDerFilter"}getUserCode(){return`
    ${P("index")} {
      if(index < uniforms.size) {
        let coords = getCoordsFromIndex(index);
        let wF = coords.x;
        let wR = coords.y;
        let wC = coords.z;
        let d1 = coords.w;
        let d2 = coords.u;

        var dotProd = 0.0;
        for (var b = 0; b < uniforms.batchSize; b++) {
          for (var yF = 0; yF < uniforms.outDepth; yF++) {
            let xF = wF + yF * uniforms.strides[0] - uniforms.pads[0];
            if (xF < 0 || xF >= uniforms.inDepth) {
              continue;
            }

            for (var yR = 0; yR < uniforms.outHeight; yR++) {
              let xR = wR + yR * uniforms.strides[1] - uniforms.pads[1];
              if (xR < 0 || xR >= uniforms.inHeight) {
                continue;
              }

              for (var yC = 0; yC < uniforms.outWidth; yC++) {
                let xC = wC + yC * uniforms.strides[2] - uniforms.pads[2];
                if (xC < 0 || xC >= uniforms.inWidth) {
                  continue;
                }

                let dyValue = getDy(b, yF, yR, yC, d2);
                let xValue = getX(b, xF, xR, xC, d1);
                dotProd += xValue * dyValue;
              }
            }
          }
        }
        setOutputAtIndex(index, dotProd);
      }
    }
  `}}class rH{constructor(e){this.variableNames=["dy","W"],this.uniforms=`filterDims : vec3<i32>, pads : vec3<i32>, strides : vec3<i32>,
      outDepth : i32, outHeight : i32, outWidth : i32, outChannels : i32,`,this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e.inShape,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.shaderKey="conv3DDerInput"}getUserCode(){return`
    ${P("index")} {
      if(index < uniforms.size) {
        let coords = getCoordsFromIndex(index);
        let batch = coords.x;
        let d1 = coords.u;

        let dyCorner = vec3<i32>(coords.y, coords.z, coords.w) - uniforms.pads;
        let dyFCorner = dyCorner.x;
        let dyRCorner = dyCorner.y;
        let dyCCorner = dyCorner.z;

        var dotProd = 0.0;
        for (var wF = 0; wF < uniforms.filterDims[0]; wF++) {
          let dyF = f32(dyFCorner + wF) / f32(uniforms.strides[0]);
          if (dyF < 0.0 || dyF >= f32(uniforms.outDepth) || fract(dyF) > 0.0) {
            continue;
          }
          let idyF = i32(dyF);

          let wFPerm = uniforms.filterDims[0] - 1 - wF;

          for (var wR = 0; wR < uniforms.filterDims[1]; wR++) {
            let dyR = f32(dyRCorner + wR) / f32(uniforms.strides[1]);

            if (dyR < 0.0 || dyR >= f32(uniforms.outHeight) || fract(dyR) > 0.0) {
              continue;
            }
            let idyR = i32(dyR);

            let wRPerm = uniforms.filterDims[1] - 1 - wR;

            for (var wC = 0; wC < uniforms.filterDims[2]; wC++) {
              let dyC = f32(dyCCorner + wC) / f32(uniforms.strides[2]);

              if (dyC < 0.0 || dyC >= f32(uniforms.outWidth) || fract(dyC) > 0.0) {
                continue;
              }
              let idyC = i32(dyC);

              let wCPerm = uniforms.filterDims[2] - 1 - wC;

              for (var d2 = 0; d2 < uniforms.outChannels; d2++) {
                let xValue = getDy(batch, idyF, idyR, idyC, d2);
                let wValue = getW(wFPerm, wRPerm, wCPerm, d1, d2);
                dotProd += xValue * wValue;
              }
            }
          }
        }
        setOutputAtIndex(index, dotProd);
      }
    }
  `}}let rX={kernelName:Y.Conv2DBackpropFilter,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a,dy:s}=t,{strides:o,pad:n,dataFormat:u,dimRoundingMode:l,filterShape:d}=r,h=m.backend_util.convertConv2DDataFormat(u),p=m.backend_util.computeConv2DInfo(a.shape,d,o,1,n,l,!1,h),c=new rV(p),f=[{type:"int32",data:[p.padInfo.top,p.padInfo.left]},{type:"int32",data:[p.strideHeight,p.strideWidth]},{type:"int32",data:[p.batchSize]},{type:"int32",data:[p.outHeight]},{type:"int32",data:[p.outWidth]},{type:"int32",data:[p.inHeight]},{type:"int32",data:[p.inWidth]}];return i.runWebGPUProgram(c,[a,s],a.dtype,f)}};class rK{constructor(e){this.variableNames=["x","W"],this.uniforms="filterDims : vec2<i32>, pads : vec2<i32>, strides : vec2<i32>, outBackprop : vec4<i32>, dimAOuter : i32, dimBOuter : i32, dimInner : i32,",this.outputShape=e.inShape,y.util.assert("channelsLast"===e.dataFormat,()=>"TODO: NCHW is unimplemented"),this.isVec4=e.inChannels%4==0&&e.outChannels%4==0,this.dispatchLayout={x:[3],y:[1,2],z:[0]},this.workgroupSize=W(this.dispatchLayout,this.outputShape,this.isVec4),this.elementsPerThread=O(this.dispatchLayout,this.outputShape,this.isVec4),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize,this.elementsPerThread),this.isVec4&&(this.outputComponent=4,this.variableComponents=[4,1]),this.shaderKey=`conv2DDerInputMM_${this.isVec4}_${this.elementsPerThread}`}getUserCode(){let e=this.isVec4?e_(this.elementsPerThread,this.workgroupSize):eL(this.elementsPerThread,this.workgroupSize);return`
    ${function(e=4){let t=`
      let outRow = row / uniforms.outShape[2];
      let outCol = row % uniforms.outShape[2];

      let WRow = col / (uniforms.filterDims[1] * uniforms.outBackprop[3]);
      let WCol = col / uniforms.outBackprop[3] % uniforms.filterDims[1];
      let xR = f32(outRow - uniforms.pads[0] + WRow) / f32(uniforms.strides[0]);
      let xC = f32(outCol - uniforms.pads[1] + WCol) / f32(uniforms.strides[1]);
      if (xR < 0.0 || xR >= f32(uniforms.outBackprop[1]) || fract(xR) > 0.0) {
        return ${k(e)}(0.0);
      }
      if (xC < 0.0 || xC >= f32(uniforms.outBackprop[2]) || fract(xC) > 0.0) {
        return ${k(e)}(0.0);
      }
      let coord = vec4<i32>(
          batch,
          i32(xR),
          i32(xC),
          col % uniforms.outBackprop[3]);
      return x[getIndexFromCoords4D(coord, uniforms.xShape)/${e}];`,i=`if (row < uniforms.dimAOuter && col < uniforms.dimInner) {
        ${t}
      }
      return ${k(e)}(0.0);`;return`
  fn mm_readA(batch: i32, row : i32, col : i32) -> ${k(e)} {
    ${i}
  }

  fn mm_readB(batch: i32, row : i32, col : i32) -> ${k(e)} {
    let coordX = uniforms.filterDims.x - 1 -
        row / (uniforms.filterDims[1] * uniforms.outBackprop[3]);
    let coordY = uniforms.filterDims.y - 1 -
        (row / uniforms.outBackprop[3]) % uniforms.filterDims[1];
    if (row < uniforms.dimInner && col < uniforms.dimBOuter &&
        coordX >= 0 && coordY >= 0) {
      let rowInner = row % uniforms.outBackprop[3];
      let coord = vec4<i32>(coordX, coordY, col, rowInner);
      ${(e=>{switch(e){case 1:return"return W[getIndexFromCoords4D(coord, uniforms.wShape)];";case 4:return`
            let coord1 = vec4<i32>(coordX, coordY, col + 1, rowInner);
            let coord2 = vec4<i32>(coordX, coordY, col + 2, rowInner);
            let coord3 = vec4<i32>(coordX, coordY, col + 3, rowInner);
            let v0 = W[getIndexFromCoords4D(coord, uniforms.wShape)];
            let v1 = W[getIndexFromCoords4D(coord1, uniforms.wShape)];
            let v2 = W[getIndexFromCoords4D(coord2, uniforms.wShape)];
            let v3 = W[getIndexFromCoords4D(coord3, uniforms.wShape)];
            return vec4<f32>(v0, v1, v2, v3);
            `;default:throw Error(`innerElementSize ${e} is not supported.`)}})(e)}
    }
    return ${k(e)}(0.0);
  }

  fn mm_write(batch: i32, row : i32, col : i32, valueInput : ${k(e)}) {
    if (row < uniforms.dimAOuter && col < uniforms.dimBOuter) {
      var value = valueInput;
      let outCoord = vec4<i32>(
          batch,
          row / uniforms.outShape[2],
          row % uniforms.outShape[2],
          col);
      result[getIndexFromCoords4D(outCoord, uniforms.outShape)/${e}] = value;
    }
  }`}(this.isVec4?4:1)}
    ${e}
    `}}let rq={kernelName:Y.Conv2DBackpropInput,backendName:"webgpu",kernelFunc:function(e){let t,{inputs:i,backend:r,attrs:a}=e,{dy:s,filter:o}=i,{inputShape:n,strides:u,pad:l,dataFormat:d,dimRoundingMode:h}=a,c=m.backend_util.convertConv2DDataFormat(d),f=m.backend_util.computeConv2DInfo(n,o.shape,u,1,l,h,!1,c),g=[{type:"int32",data:[f.filterHeight,f.filterWidth]},{type:"int32",data:[f.filterHeight-1-f.padInfo.top,f.filterWidth-1-f.padInfo.left]},{type:"int32",data:[f.strideHeight,f.strideWidth]},{type:"int32",data:[f.batchSize,f.outHeight,f.outWidth,f.outChannels]}];if((0,p.env)().getBool("WEBGPU_USE_NAIVE_CONV2D_TRANSPOSE")||"channelsLast"!==f.dataFormat)t=new rM(f);else{t=new rK(f);let e=f.inHeight*f.inWidth,i=f.inChannels,r=f.filterHeight*f.filterWidth*f.outChannels;g.push({type:"uint32",data:[e]},{type:"uint32",data:[i]},{type:"uint32",data:[r]})}return r.runWebGPUProgram(t,[s,o],"float32",g)}};class rY{constructor(e){this.variableNames=["x","W"],this.uniforms="filterDims: vec3<i32>, pads: vec3<i32>, strides: vec3<i32>, dilations: vec3<i32>,",this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e.outShape,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.shaderKey="conv3dnaive"}getUserCode(){return`
    ${P("index")} {
      if (index < uniforms.size) {
        let coords = getOutputCoords();
        let batch = coords.x;
        let d2 = coords.u;

        let xFRCCorner = vec3<i32>(coords.y, coords.z, coords.w) * uniforms.strides - uniforms.pads;
        let xFCorner = xFRCCorner.x;
        let xRCorner = xFRCCorner.y;
        let xCCorner = xFRCCorner.z;

        let inputDepthNearestVec4 = (uniforms.xShape.u / 4) * 4;
        let inputDepthVec4Remainder = uniforms.xShape.u % 4;

        var dotProd = 0.0;
        for (var wF = 0; wF < uniforms.filterDims[0]; wF++) {
          let xF = xFCorner + wF * uniforms.dilations[0];
          if (xF < 0 || xF >= uniforms.xShape.y) {
            continue;
          }

          for (var wR = 0; wR < uniforms.filterDims[1]; wR++) {
            let xR = xRCorner + wR * uniforms.dilations[1];
            if (xR < 0 || xR >= uniforms.xShape.z) {
              continue;
            }

            for (var wC = 0; wC < uniforms.filterDims[2]; wC++) {
              let xC = xCCorner + wC * uniforms.dilations[2];
              if (xC < 0 || xC >= uniforms.xShape.w) {
                continue;
              }

              for (var d1 = 0; d1 < inputDepthNearestVec4; d1 += 4) {
                let xValues = vec4<f32>(
                  getX(batch, xF, xR, xC, d1),
                  getX(batch, xF, xR, xC, d1 + 1),
                  getX(batch, xF, xR, xC, d1 + 2),
                  getX(batch, xF, xR, xC, d1 + 3)
                );
                let wValues = vec4<f32>(
                  getW(wF, wR, wC, d1, d2),
                  getW(wF, wR, wC, d1 + 1, d2),
                  getW(wF, wR, wC, d1 + 2, d2),
                  getW(wF, wR, wC, d1 + 3, d2)
                );

                dotProd += dot(xValues, wValues);
              }

              if (inputDepthVec4Remainder == 1) {
                dotProd += getX(batch, xF, xR, xC, inputDepthNearestVec4) *
                  getW(wF, wR, wC, inputDepthNearestVec4, d2);
              } else if (inputDepthVec4Remainder == 2) {
                let xValues = vec2<f32>(
                  getX(batch, xF, xR, xC, inputDepthNearestVec4),
                  getX(batch, xF, xR, xC, inputDepthNearestVec4 + 1)
                );
                let wValues = vec2<f32>(
                  getW(wF, wR, wC, inputDepthNearestVec4, d2),
                  getW(wF, wR, wC, inputDepthNearestVec4 + 1, d2)
                );
                dotProd += dot(xValues, wValues);
              } else if (inputDepthVec4Remainder == 3) {
                let xValues = vec3<f32>(
                  getX(batch, xF, xR, xC, inputDepthNearestVec4),
                  getX(batch, xF, xR, xC, inputDepthNearestVec4 + 1),
                  getX(batch, xF, xR, xC, inputDepthNearestVec4 + 2)
                );
                let wValues = vec3<f32>(
                  getW(wF, wR, wC, inputDepthNearestVec4, d2),
                  getW(wF, wR, wC, inputDepthNearestVec4 + 1, d2),
                  getW(wF, wR, wC, inputDepthNearestVec4 + 2, d2)
                );
                dotProd += dot(xValues, wValues);
              }
            }
          }
        }
        setOutputAtIndex(index, dotProd);
      }
    }`}}let rj={kernelName:Y.Conv3D,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a,filter:s}=t,{strides:o,pad:n,dilations:u}=r,l=m.backend_util.computeConv3DInfo(a.shape,s.shape,o,u,n),d=[l.padInfo.front,l.padInfo.top,l.padInfo.left],h=[{type:"int32",data:[l.filterDepth,l.filterHeight,l.filterWidth]},{type:"int32",data:[...d]},{type:"int32",data:[l.strideDepth,l.strideHeight,l.strideWidth]},{type:"int32",data:[l.dilationDepth,l.dilationHeight,l.dilationWidth]}],p=new rY(l),c=(0,ej.upcastType)(a.dtype,s.dtype);return i.runWebGPUProgram(p,[a,s],c,h)}},rQ={kernelName:Y.Conv3DBackpropFilterV2,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a,dy:s}=t,{strides:o,pad:n,filterShape:u}=r,l=m.backend_util.computeConv3DInfo(a.shape,u,o,1,n),d=new rG(l),h=[{type:"int32",data:[l.padInfo.front,l.padInfo.top,l.padInfo.left]},{type:"int32",data:[l.strideDepth,l.strideHeight,l.strideWidth]},{type:"int32",data:[l.batchSize]},{type:"int32",data:[l.outDepth]},{type:"int32",data:[l.outHeight]},{type:"int32",data:[l.outWidth]},{type:"int32",data:[l.inDepth]},{type:"int32",data:[l.inHeight]},{type:"int32",data:[l.inWidth]}];return i.runWebGPUProgram(d,[a,s],s.dtype,h)}},rZ={kernelName:Y.Conv3DBackpropInputV2,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{dy:a,filter:s}=t,{strides:o,pad:n,inputShape:u}=r,l=m.backend_util.computeConv3DInfo(u,s.shape,o,1,n),d=new rH(l),h=[{type:"int32",data:[l.filterDepth,l.filterHeight,l.filterWidth]},{type:"int32",data:[l.filterDepth-1-l.padInfo.front,l.filterHeight-1-l.padInfo.top,l.filterWidth-1-l.padInfo.left]},{type:"int32",data:[l.strideDepth,l.strideHeight,l.strideWidth]},{type:"int32",data:[l.outDepth]},{type:"int32",data:[l.outHeight]},{type:"int32",data:[l.outWidth]},{type:"int32",data:[l.outChannels]}];return i.runWebGPUProgram(d,[a,s],a.dtype,h)}},rJ=e4({opType:d.COS}),r2={kernelName:Y.Cos,backendName:"webgpu",kernelFunc:rJ},r0=e4({opType:d.COSH}),r1={kernelName:Y.Cosh,backendName:"webgpu",kernelFunc:r0};class r3{constructor(e,t,i,r){this.variableNames=["Image","Boxes","BoxInd"],this.uniforms="extrapolationValue : f32,",this.workgroupSize=[64,1,1],this.size=!0;const[a]=t;this.outputShape=[a,i[0],i[1],e],this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.methodId=+("bilinear"===r),this.cropHeightBiggerThan1=this.outputShape[1]>1,this.cropWidthBiggerThan1=this.outputShape[2]>1,this.shaderKey=`cropAndResize_${this.methodId}_${this.cropHeightBiggerThan1}_${this.cropWidthBiggerThan1}`}getUserCode(){let[e,t]=["f32(uniforms.imageShape[1] - 1)","f32(uniforms.imageShape[2] - 1)"],[i,r,a]=this.cropHeightBiggerThan1?[`(${e} / f32(uniforms.outShape[1] - 1))`,"(y2-y1) * height_ratio",`y1*${e} + f32(y)*(height_scale)`]:["0.0","0.0",`0.5 * (y1+y2) * ${e}`],[s,o,n]=this.cropWidthBiggerThan1?[`(${t} / f32(uniforms.outShape[2] - 1))`,"(x2-x1) * width_ratio",`x1*${t} + f32(x)*(width_scale)`]:["0.0","0.0",`0.5 * (x1+x2) * ${t}`];return`
    ${P("index")} {
      if (index < uniforms.size) {
        let coords = getCoordsFromIndex(index);
        let height_ratio = f32(${i});
        let width_ratio = f32(${s});
        let b = coords[0];
        let y = coords[1];
        let x = coords[2];
        let d = coords[3];
        // get box vals
        let y1 = getBoxes(b, 0);
        let x1 = getBoxes(b, 1);
        let y2 = getBoxes(b, 2);
        let x2 = getBoxes(b, 3);
        // get image in batch index
        let bInd = i32(round(getBoxInd(b)));
        if(bInd < 0 || bInd >= uniforms.outShape[0]) {
          return;
        }
        let height_scale = ${r};
        let width_scale = ${o};
        let in_y = ${a};
        if( in_y < 0.0 || in_y > ${e} ) {
          setOutputAtIndex(index, uniforms.extrapolationValue);
          return;
        }
        let in_x = ${n};
        if( in_x < 0.0 || in_x > ${t} ) {
          setOutputAtIndex(index, uniforms.extrapolationValue);
          return;
        }
        let sourceFracIndexCR = vec2<f32>(in_x,in_y);
        if(${this.methodId} == 1) {
          // Compute the four integer indices.
          let sourceFloorCR = vec2<i32>(sourceFracIndexCR);
          let sourceCeilCR = vec2<i32>(ceil(sourceFracIndexCR));
          let topLeft = getImage(bInd, sourceFloorCR.y, sourceFloorCR.x, d);
          let bottomLeft = getImage(bInd, sourceCeilCR.y, sourceFloorCR.x, d);
          let topRight = getImage(bInd, sourceFloorCR.y, sourceCeilCR.x, d);
          let bottomRight = getImage(bInd, sourceCeilCR.y, sourceCeilCR.x, d);
          let fracCR = sourceFracIndexCR - vec2<f32>(sourceFloorCR);
          let top = topLeft + (topRight - topLeft) * fracCR.x;
          let bottom = bottomLeft + (bottomRight - bottomLeft) * fracCR.x;
          let newValue = top + (bottom - top) * fracCR.y;
          setOutputAtIndex(index, newValue);
        } else {
          // Compute the coordinators of nearest neighbor point.
          let sourceNearestCR = vec2<i32>(floor(
            sourceFracIndexCR + vec2<f32>(0.5,0.5)));
          let newValue = getImage(
            bInd, sourceNearestCR.y, sourceNearestCR.x, d);
          setOutputAtIndex(index, newValue);
        }
      }
    }
    `}}let r4={kernelName:Y.CropAndResize,backendName:"webgpu",kernelFunc:e=>{let{inputs:t,backend:i,attrs:r}=e,{image:a,boxes:s,boxInd:o}=t,{cropSize:n,method:u,extrapolationValue:l}=r,d=new r3(a.shape[3],s.shape,n,u);return i.runWebGPUProgram(d,[a,s,o],"float32",[{type:"float32",data:[l]}])}};(o=h||(h={})).Prod="*",o.Sum="+";class r6{constructor(e,t,i,r){this.variableNames=["x"],this.uniforms="index : f32,",this.size=!0,this.workgroupSize=[128,1,1],this.outputShape=t,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.exclusive=i,this.reverse=r,this.op=e,this.shaderKey=`cum_${this.op}_${this.exclusive}_${this.reverse}`}getUserCode(){let e=this.outputShape.length,t=this.op===h.Prod?"1.0":"0.0",i=this.exclusive?t:`getX(${r5(e,"coords",this.op)})`,r=this.outputShape[this.outputShape.length-1],a="",s="";return this.exclusive?(a=this.reverse?`end != ${r-1}`:"end != 0",s=this.reverse?"end + 1":"end - 1"):(a=this.reverse?`end + pow2 < ${r}`:"end >= pow2",s=this.reverse?"end + pow2":"end - pow2"),`
      ${P("index")} {
       if (index < uniforms.size) {
         var coords = getCoordsFromIndex(index);

         let end = ${r8(e,"coords",this.op)};
         var val = ${i};
         let pow2 = i32(pow(2.0, uniforms.index));
         if (${a}) {
           let idx = ${s};
           ${r8(e,"coords",this.op)} = idx;
           val ${this.op}= getX(${r5(e,"coords",this.op)});
         }
         setOutputAtIndex(index, val);
       }
      }
    `}}function r5(e,t,i){if(1===e)return`${t}`;if(2===e)return`${t}.x, ${t}.y`;if(3===e)return`${t}.x, ${t}.y, ${t}.z`;if(4===e)return`${t}.x, ${t}.y, ${t}.z, ${t}.w`;throw Error(`Cumulative ${i} for rank ${e} is not yet supported`)}function r8(e,t,i){if(1===e)return`${t}`;if(2===e)return`${t}.y`;if(3===e)return`${t}.z`;if(4===e)return`${t}.w`;throw Error(`Cumulative ${i} for rank ${e} is not yet supported`)}function r9(e,t,i,r,a,s){let o=t.shape.length,n=m.backend_util.getAxesPermutation([r],o),u=t;null!=n&&(u=iF({inputs:{x:t},backend:i,attrs:{perm:n}}));let l=m.backend_util.getInnerMostAxes(1,o)[0];if(l!==o-1)throw Error(`WebGPU cumprod shader expects an inner-most axis=${t.shape.length-1} but got axis=${r}`);let d=u.shape[l],h=eJ({inputs:{x:u},backend:i});for(let t=0;t<=Math.ceil(Math.log2(d))-1;t++){let r=new r6(e,u.shape,!1,s),a=h,o=[{type:"float32",data:[t]}];h=i.runWebGPUProgram(r,[h],h.dtype,o),i.disposeData(a.dataId)}if(a){let t=new r6(e,u.shape,a,s),r=h;h=i.runWebGPUProgram(t,[h],h.dtype,[{type:"float32",data:[0]}]),i.disposeData(r.dataId)}if(null!=n){let e=iF({inputs:{x:h},backend:i,attrs:{perm:m.backend_util.getUndoAxesPermutation(n)}});return i.disposeData(h.dataId),i.disposeData(u.dataId),e}return h}let r7={kernelName:Y.Cumprod,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a}=t,{axis:s,exclusive:o,reverse:n}=r;return r9(h.Prod,a,i,s,o,n)}},ae={kernelName:Y.Cumsum,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a}=t,{axis:s,exclusive:o,reverse:n}=r;return r9(h.Sum,a,i,s,o,n)}},at={kernelName:Y.DenseBincount,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a,weights:s}=t,{size:o,binaryOutput:n}=r,u=1===a.shape.length,l=y.util.sizeFromShape(s.shape)>0,d=s.dtype,h=u?[a.shape[0]]:[a.shape[0],a.shape[1]],p=eG({backend:i,attrs:{shape:u?[o]:[a.shape[0],o],value:0,dtype:d}}),c=new rc(h,l,n),f=[{type:"int32",data:[o]}],m=l?[a,s]:[a];return i.runWebGPUProgram(c,m,d,f,p)}};class ai{constructor(e,t){this.variableNames=["x"],this.workgroupSize=[64,1,1],this.size=!0,this.uniforms="blockSize : i32,",this.outputShape=e,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.shaderKey=`depthToSpace_${t}`,this.dataFormat=t}getUserCode(){return`
      ${P("index")} {
        if (index < uniforms.size) {
          let coords = getCoordsFromIndex(index);
          let b = coords[0];
          let h = ${this.getHeightCoordString()};
          let w = ${this.getWidthCoordString()};
          let d = ${this.getDepthCoordString()};

          let in_h = h / uniforms.blockSize;
          let offset_h = h % uniforms.blockSize;
          let in_w = w / uniforms.blockSize;
          let offset_w = w % uniforms.blockSize;
          let offset_d = (offset_h * uniforms.blockSize + offset_w) *
            ${this.getOutputDepthSize()};
          let in_d = d + offset_d;

          let rlt = ${this.getInputSamplingString()};
          setOutputAtIndex(index, rlt);
        }
      }`}getHeightCoordString(){return"NHWC"===this.dataFormat?"coords[1]":"coords[2]"}getWidthCoordString(){return"NHWC"===this.dataFormat?"coords[2]":"coords[3]"}getDepthCoordString(){return"NHWC"===this.dataFormat?"coords[3]":"coords[1]"}getOutputDepthSize(){return"NHWC"===this.dataFormat?"uniforms.outShape[3]":"uniforms.outShape[1]"}getInputSamplingString(){return"NHWC"===this.dataFormat?"getX(b, in_h, in_w, in_d)":"getX(b, in_d, in_h, in_w)"}}let ar={kernelName:Y.DepthToSpace,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a}=t,{blockSize:s,dataFormat:o}=r,n=a.shape[0],u="NHWC"===o?a.shape[1]:a.shape[2],l="NHWC"===o?a.shape[2]:a.shape[3],d="NHWC"===o?a.shape[3]:a.shape[1],h=u*s,p=l*s,c=d/(s*s),f=new ai("NHWC"===o?[n,h,p,c]:[n,c,h,p],o);return i.runWebGPUProgram(f,[a],a.dtype,[{type:"int32",data:[s]}])}};class aa{constructor(e,t,i,r=!1,a=null,s=!1){this.variableNames=["x","W"],this.uniforms="pads : vec2<i32>, inDims : vec2<i32>,",this.workgroupSize=[16,16,1],this.outputShape=e,this.dispatchLayout={x:[3],y:[2],z:[0,1]},this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),r&&this.variableNames.push("bias"),s&&this.variableNames.push("preluActivationWeights"),this.addBias=r,this.activation=a,this.hasPreluActivation=s,this.filterHeight=t,this.filterWidth=i,this.shaderKey=`depthwiseNCHW_${this.activation}_${this.filterHeight}_${this.filterWidth}`}getUserCode(){let e=this.filterWidth*this.filterHeight,t=this.workgroupSize[0]*this.workgroupSize[1]*this.workgroupSize[2],i=this.workgroupSize[1]+this.filterHeight-1,r=this.workgroupSize[0]+this.filterWidth-1;return`
      ${eN(this.activation,this.hasPreluActivation,!1,4)}

      var<workgroup> mm_Asub : array<array<f32, ${r}>, ${i}>;
      var<workgroup> mm_Bsub : array<array<f32, ${this.filterWidth}>, ${this.filterHeight}>;
      fn readX(batch : i32, channel : i32, row : i32, col : i32) -> f32 {
        var value = 0.0;
        if (row >=0 && row < uniforms.inDims[0] && col >=0 && col < uniforms.inDims[1])
        {
          value = getX(batch, channel, row, col);
        }
        return value;
      }

      ${P()} {
        let coords = getOutputCoords();
        let batch = coords[0];
        let xRCCorner = vec2<i32>(coords.zw) - uniforms.pads;
        let channelMul = uniforms.wShape[3];
        let d1 = coords[1] / channelMul;
        let q = coords[1] % channelMul;

        let inputRowStart = xRCCorner.x;
        let inputColStart = xRCCorner.y;

        let localRow = i32(localId.y);
        let localCol = i32(localId.x);

        // Load one tile of X into local memory.
        for (var inputRow = localRow; inputRow < ${i}; inputRow = inputRow + ${this.workgroupSize[1]}) {
          for (var inputCol = localCol; inputCol < ${r}; inputCol = inputCol + ${this.workgroupSize[0]}) {
            let rowOffset = inputRow - localRow;
            let colOffset = inputCol - localCol;
            mm_Asub[inputRow][inputCol] = readX(batch, d1, inputRowStart + rowOffset, inputColStart + colOffset);
          }
        }

        // Load one tile of W into local memory.
        var wIndex = i32(localIndex);
        ${e<t?`if (wIndex < ${e})`:`for(; wIndex < ${e}; wIndex = wIndex + ${t})`}

        {
          let wRow = wIndex / ${this.filterWidth};
          let wCol = wIndex % ${this.filterWidth};
          mm_Bsub[wRow][wCol] = getW(wRow, wCol, d1, q);
        }

        workgroupBarrier();

        var value = 0.0;
        for (var wR = 0; wR < ${this.filterHeight}; wR = wR + 1) {
          for (var wC = 0; wC < ${this.filterWidth}; wC = wC + 1) {
            let xVal = mm_Asub[localRow + wR][localCol + wC];
            let wVal = mm_Bsub[wR][wC];
            value = fma(xVal, wVal, value);
          }
        }
        ${eD(this.addBias,this.activation)}
        if (coordsInBounds4D(coords, uniforms.outShape)) {
          setOutputAtCoords(coords[0], coords[1], coords[2], coords[3], value);
        }
      }
    `}}class as{constructor(e,t=!1,i=null,r=!1){this.variableNames=["x","W"],this.uniforms="pads : vec2<i32>, inDims : vec2<i32>, virtualWidth : i32,",this.workgroupSize=[64,1,1],this.workPerThread=4,this.outputComponent=4,this.outputShape=e.outShape,this.virtualWidth=Math.ceil(this.outputShape[2]/this.workPerThread)*this.workPerThread;const a=[this.outputShape[0],this.outputShape[1],this.virtualWidth,this.outputShape[3]];this.dispatchLayout=U(a),this.dispatch=L(this.dispatchLayout,a,this.workgroupSize,[this.outputComponent*this.workPerThread,1,1]),y.util.assert("channelsLast"===e.dataFormat,()=>"TODO: NCHW is unimplemented"),t&&this.variableNames.push("bias"),r&&this.variableNames.push("preluActivationWeights"),this.convInfo=e,this.addBias=t,this.activation=i,this.hasPreluActivation=r,this.shaderKey=`depthwiseVec4_${i}_${this.convInfo.filterHeight}_${this.convInfo.filterWidth}_${this.convInfo.strideHeight}_${this.convInfo.strideWidth}_${this.workPerThread}`}getUserCode(){let e=(this.workPerThread-1)*this.convInfo.strideWidth+this.convInfo.filterWidth,t=this.convInfo.strideHeight,i=this.convInfo.strideWidth;return`
      ${eN(this.activation,this.hasPreluActivation,!0,4)}
      fn readX(batch : i32, row : i32, col : i32, channel : i32) -> vec4<f32> {
        var value = vec4<f32>(0.0);
        if (col >=0 && col < uniforms.inDims[1]) {
          value = getX(batch, row, col, channel);
        }
        return value;
      }

      ${P("index")} {
        let width0 = uniforms.outShape[3] / ${this.outputComponent};
        let d1 = (index % width0) * ${this.outputComponent};
        var index1 = index / width0;
        let width1 = uniforms.virtualWidth / ${this.workPerThread};
        let c = (index1 % width1) * ${this.workPerThread};
        index1 = index1 / width1;
        let r = index1 % uniforms.outShape[1];
        let batch = index1 / uniforms.outShape[1];

        let xRCCorner = vec2<i32>(r, c) * vec2<i32>(${t}, ${i}) - uniforms.pads;

        let xRCorner = xRCCorner.x;
        let xCCorner = xRCCorner.y;
        var xVals : array<vec4<f32>, ${e}>;
        var dotProd : array<vec4<f32>, ${this.workPerThread}>;
        for (var i = 0; i < ${this.workPerThread}; i++) {
          dotProd[i] = vec4<f32>(0.0);
        }

        // Use constant instead of uniform can give better performance.
        for (var wR = 0; wR < ${this.convInfo.filterHeight}; wR = wR + 1) {
          let xR = xRCorner + wR;
          if (xR >=0 && xR < uniforms.inDims[0]) {
            for (var i = 0; i < ${e}; i++) {
              xVals[i] = readX(batch, xR, xCCorner + i, d1);
            }
            for (var wC = 0; wC < ${this.convInfo.filterWidth}; wC = wC + 1) {
              let wValue = getW(wR, wC, d1, 0);
              for (var i = 0; i < ${this.workPerThread}; i++) {
                dotProd[i] = fma(xVals[i * ${i} + wC], wValue, dotProd[i]);
              }
            }
          }
        }

        for (var i = 0; i < ${this.workPerThread}; i = i + 1) {
          let coords = vec4<i32>(batch, r, c + i, d1);
          if (coordsInBounds4D(coords, uniforms.outShape)) {
            var value = dotProd[i];
            ${eD(this.addBias,this.activation)}
            setOutputAtCoords(coords[0], coords[1], coords[2], coords[3], value);
          }
        }
      }
    `}}class ao{constructor(e,t=!1,i=null,r=!1){this.variableNames=["x","W"],this.uniforms=`pads : vec2<i32>, inDims : vec2<i32>, filterHeight : i32,
      filterWidth : i32, strides : vec2<i32>, dilations : vec2<i32>,`,this.workgroupSize=[256,1,1],this.size=!0,this.outputShape=e.outShape,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.isChannelsLast="channelsLast"===e.dataFormat,t&&this.variableNames.push("bias"),r&&this.variableNames.push("preluActivationWeights"),this.convInfo=e,this.addBias=t,this.activation=i,this.hasPreluActivation=r,this.shaderKey=`depthwise_${this.activation}_${this.isChannelsLast}`}getUserCode(){let e=this.isChannelsLast?"getX(batch, xR, xC, d1);":"getX(batch, d1, xR, xC);";return`
      ${eN(this.activation,this.hasPreluActivation,!1,4)}

      ${P("index")} {
        if (index < uniforms.size) {
          let coords = getOutputCoords();
          let batch = coords[0];
          let xRCCorner = vec2<i32>(coords.${this.isChannelsLast?"yz":"zw"}) * uniforms.strides - uniforms.pads;
          let d2 = coords[${this.isChannelsLast?3:1}];
          let channelMul = uniforms.wShape[3];
          let d1 = d2 / channelMul;
          let q = d2 % channelMul;

          let inputRowStart = xRCCorner.x;
          let inputColStart = xRCCorner.y;
          let inputRowEnd = inputRowStart + uniforms.filterHeight *
              uniforms.dilations[0];
          let inputColEnd = inputColStart + uniforms.filterWidth *
              uniforms.dilations[1];

          // Convolve x(?, ?, d1)|x(d1, ?, ?) with w(:, :, d1, q) to get
          // y(yR, yC, d2)|y(d2, yR, yC). ? = to be determined. : = across all
          // values in that axis. x(?, ?, d1) and y(yR, yC, d2) is for NHWC.
          // x(d1, ?, ?) and y(d2, yR, yC) is for NCHW.
          var value = 0.0;

          // Extract if checking out of for loop for performance.
          if (inputRowStart >= 0 && inputColStart >= 0 &&
            inputRowEnd < uniforms.inDims[0] &&
                inputColEnd < uniforms.inDims[1]) {
              for (var wR = 0; wR < uniforms.filterHeight; wR = wR + 1) {
                let xR = inputRowStart + wR * uniforms.dilations[0];

                for (var wC = 0; wC < uniforms.filterWidth; wC = wC + 1) {
                  let xC = inputColStart + wC * uniforms.dilations[1];

                  let xVal = ${e};
                  let wVal = getW(wR, wC, d1, q);
                  value = value + xVal * wVal;
                }
              }
            } else {
              for (var wR = 0; wR < uniforms.filterHeight; wR = wR + 1) {
                let xR = inputRowStart + wR * uniforms.dilations[0];

                if (xR < 0 || xR >= uniforms.inDims[0]) {
                  continue;
                }

                for (var wC = 0; wC < uniforms.filterWidth; wC = wC + 1) {
                  let xC = inputColStart + wC * uniforms.dilations[1];

                  if (xC < 0 || xC >= uniforms.inDims[1]) {
                    continue;
                  }

                  let xVal = ${e};
                  let wVal = getW(wR, wC, d1, q);
                  value = value + xVal * wVal;
                }
              }
            }
            ${eD(this.addBias,this.activation)}
          setOutputAtCoords(coords[0], coords[1], coords[2], coords[3], value);
        }
      }
    `}}let an={kernelName:Y.DepthwiseConv2dNative,backendName:"webgpu",kernelFunc:function(e){let t,{inputs:i,backend:r,attrs:a}=e,{x:s,filter:o}=i,{strides:n,pad:u,dataFormat:l,dilations:d,dimRoundingMode:h}=a,p=m.backend_util.convertConv2DDataFormat(l),c=d;null==c&&(c=[1,1]);let f=m.backend_util.computeConv2DInfo(s.shape,o.shape,n,c,u,h,!0,p),g=[{type:"int32",data:[f.padInfo.top,f.padInfo.left]},{type:"int32",data:[f.inHeight,f.inWidth]}],x="channelsLast"===f.dataFormat;return!x&&f.inHeight>16&&f.inWidth>16&&1===f.strideHeight&&1===f.strideWidth&&1===f.dilationWidth&&1===f.dilationHeight&&f.inChannels===f.outChannels?t=new aa(f.outShape,f.filterHeight,f.filterWidth):x&&f.outHeight>4&&f.outWidth>4&&f.strideWidth<=2&&f.inChannels===f.outChannels&&1===f.dilationHeight&&1===f.dilationWidth&&f.inChannels%4==0?(t=new as(f),g.push({type:"int32",data:[t.virtualWidth]})):(t=new ao(f),g.push({type:"int32",data:[f.filterHeight]},{type:"int32",data:[f.filterWidth]},{type:"int32",data:[f.strideHeight,f.strideWidth]},{type:"int32",data:[f.dilationHeight,f.dilationWidth]})),r.runWebGPUProgram(t,[s,o],s.dtype,g)}};class au{constructor(e){this.variableNames=["x","dy"],this.uniforms=`strides : vec2<i32>, pads : vec2<i32>, filterDims : vec2<i32>, outHeight : i32,
      outWidth : i32, inHeight : i32, inWidth : i32, batchSize : i32, channelMul : i32,`,this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e.filterShape,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.shaderKey="depthwise_conv2d_backprop_filter"}getUserCode(){return`
      ${P("index")} {
      if (index < uniforms.size) {
        let coords = getCoordsFromIndex(index);
        let wR = coords[0];
        let wC = coords[1];
        let d1 = coords[2];
        let dm = coords[3];
        let d2 = d1 * uniforms.channelMul + dm;

        var dotProd = 0.0;
        for (var b = 0; b < uniforms.batchSize; b++) {
          for (var yR = 0; yR < uniforms.outHeight; yR++) {
            let xR = wR + yR * uniforms.strides[0] - uniforms.pads[0];

            if (xR < 0 || xR >= uniforms.inHeight) {
              continue;
            }

            for (var yC = 0; yC < uniforms.outWidth; yC++) {
              let xC = wC + yC * uniforms.strides[1] - uniforms.pads[1];

              if (xC < 0 || xC >= uniforms.inWidth) {
                continue;
              }

              let dyValue = getDy(b, yR, yC, d2);
              let xValue = getX(b, xR, xC, d1);
              dotProd += xValue * dyValue;
            }
          }
        }
        setOutputAtIndex(index, dotProd);
      }
    }
    `}}class al{constructor(e){this.variableNames=["dy","W"],this.uniforms=`strides : vec2<i32>, pads : vec2<i32>, filterDims : vec2<i32>,
       outHeight : i32, outWidth : i32, channelMul : i32,`,this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e.inShape,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.shaderKey="depthwise_conv2d_backprop_input"}getUserCode(){return`
      ${P("index")} {
      if (index < uniforms.size) {
        let coords = getCoordsFromIndex(index);
        let batch = coords[0];
        let d1 = coords[3];
        let dyCorner = coords.yz - uniforms.pads;
        let dyRCorner = dyCorner.x;
        let dyCCorner = dyCorner.y;

        var dotProd = 0.0;
        for (var wR = 0; wR < uniforms.filterDims[0]; wR++) {
          let dyR = f32(dyRCorner + wR) / f32(uniforms.strides[0]);

          if (dyR < 0.0 || dyR >= f32(uniforms.outHeight) || fract(dyR) > 0.0) {
            continue;
          }

          let idyR = i32(dyR);
          let wRPerm = uniforms.filterDims[0] - 1 - wR;

          for (var wC = 0; wC < uniforms.filterDims[1]; wC++) {
            let dyC = f32(dyCCorner + wC) / f32(uniforms.strides[1]);

            if (dyC < 0.0 || dyC >= f32(uniforms.outWidth) || fract(dyC) > 0.0) {
              continue;
            }

            let idyC = i32(dyC);
            let wCPerm = uniforms.filterDims[1] - 1 - wC;

            for (var dm = 0; dm < uniforms.channelMul; dm++) {
              let d2 = d1 * uniforms.channelMul + dm;
              let xValue = getDy(batch, idyR, idyC, d2);
              let wValue = getW(wRPerm, wCPerm, d1, dm);
              dotProd += xValue * wValue;
            }
          }
        }
        setOutputAtIndex(index, dotProd);
      }
    }
    `}}let ad={kernelName:Y.DepthwiseConv2dNativeBackpropFilter,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a,dy:s}=t,{strides:o,dilations:n,pad:u,dimRoundingMode:l,filterShape:d}=r,h=m.backend_util.computeConv2DInfo(a.shape,d,o,n,u,l,!0),p=new au(h),c=[{type:"int32",data:[h.strideHeight,h.strideWidth]},{type:"int32",data:[h.padInfo.top,h.padInfo.left]},{type:"int32",data:[h.filterHeight,h.filterWidth]},{type:"int32",data:[h.outHeight]},{type:"int32",data:[h.outWidth]},{type:"int32",data:[h.inHeight]},{type:"int32",data:[h.inWidth]},{type:"int32",data:[h.batchSize]},{type:"int32",data:[h.outChannels/h.inChannels]}];return i.runWebGPUProgram(p,[a,s],"float32",c)}},ah={kernelName:Y.DepthwiseConv2dNativeBackpropInput,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{dy:a,filter:s}=t,{strides:o,dilations:n,pad:u,dimRoundingMode:l,inputShape:d}=r,h=m.backend_util.computeConv2DInfo(d,s.shape,o,n,u,l,!0),p=new al(h),c=[{type:"int32",data:[h.strideHeight,h.strideWidth]},{type:"int32",data:[h.filterHeight-1-h.padInfo.top,h.filterWidth-1-h.padInfo.left]},{type:"int32",data:[h.filterHeight,h.filterWidth]},{type:"int32",data:[h.outHeight]},{type:"int32",data:[h.outWidth]},{type:"int32",data:[h.outChannels/h.inChannels]}];return i.runWebGPUProgram(p,[a,s],a.dtype,c)}};class ap{constructor(e){this.variableNames=["x"],this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=[e,e],this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.shaderKey="diag"}getUserCode(){return`
      ${P("index")} {
        if (index < uniforms.size) {
          let coords = getOutputCoords();
          let value = select(0.0, getX(coords[0]), coords[0] == coords[1]);
          setOutputAtIndex(index, value);
        }
      }
    `}}let ac={kernelName:Y.Diag,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i}=e,{x:r}=t,a=[...r.shape,...r.shape],s=y.util.sizeFromShape(r.shape),o=eX({inputs:{x:r},backend:i,attrs:{shape:[s]}}),n=new ap(s),u=i.runWebGPUProgram(n,[o],o.dtype),l=eX({inputs:{x:u},backend:i,attrs:{shape:a}});return i.disposeData(o.dataId),i.disposeData(u.dataId),l}};class af{constructor(e){this.variableNames=["x","w"],this.uniforms="filterDims: vec2<i32>, pads: vec2<i32>, strides: vec2<i32>, dilations: vec2<i32>",this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e.outShape,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.shaderKey="dilation2d"}getUserCode(){return`
       ${P("index")} {
         if (index < uniforms.size) {
           let neg_infinity = -3.4e38;
           let coords = getOutputCoords();
           let batch = coords.x;
           let d1 = coords.w;
           let outTopLeftCorner = coords.yz * uniforms.strides - uniforms.pads;
           let hBeg = outTopLeftCorner.x;
           let wBeg = outTopLeftCorner.y;

           var curVal = neg_infinity;
           for (var h = 0; h < uniforms.filterDims[0]; h = h + 1) {
             let hIn = hBeg + h * uniforms.dilations[0];

             if (hIn >= 0 && hIn < uniforms.xShape[1]) {
               for (var w = 0; w < uniforms.filterDims[1]; w = w + 1) {
                 let wIn = wBeg + w * uniforms.dilations[1];

                 if (wIn >= 0 && wIn < uniforms.xShape[2]) {
                   let val = getX(batch, hIn, wIn, d1) + getW(h, w, d1);
                   if (val > curVal) {
                     curVal = val;
                   }
                 }
               }
             }
           }

           setOutputAtIndex(index, curVal);
         }
       }
     `}}let am={kernelName:Y.Dilation2D,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a,filter:s}=t,{strides:o,pad:n,dilations:u}=r,l=m.backend_util.computeDilation2DInfo(a.shape,s.shape,o,n,"NHWC",u),d=[l.padInfo.top,l.padInfo.left],h=[{type:"int32",data:[l.filterHeight,l.filterWidth]},{type:"int32",data:[...d]},{type:"int32",data:[l.strideHeight,l.strideWidth]},{type:"int32",data:[l.dilationHeight,l.dilationWidth]}],p=new af(l);return i.runWebGPUProgram(p,[a,s],a.dtype,h)}};class ag{constructor(e,t){if(this.variableNames=["x","w","dy"],this.uniforms="filterDims: vec2<i32>, pads: vec2<i32>, strides: vec2<i32>, dilations: vec2<i32>, dySize: i32,",this.workgroupSize=[64,1,1],this.atomic=!0,this.outputShape=e.inShape,this.dispatchLayout=U(e.outShape),this.dispatch=L(this.dispatchLayout,e.outShape,this.workgroupSize),"float32"!==t&&"int32"!==t)throw Error(`Dilation2DBackpropInput only supports float32 and int32
          types, does not support ${t} type.`);this.type=t,this.shaderKey="dilation2DBackpropInput"}getUserCode(){return`
       ${P("index")} {
         if (index < uniforms.dySize) {
           let coords = getDyCoordsFromIndex(index);
           let b = coords[0];
           let r = coords[1];
           let c = coords[2];
           let d = coords[3];

           let dyCorner = vec2<i32>(r, c) * uniforms.strides - uniforms.pads;
           var curVal = -3.4e38;  // neg_infinity
           var xRMax = 0;
           var xCMax = 0;

           // In the case of multiple argmax branches, we only back-propagate
           // along the last branch, i.e., the one with largest value of
           // 'wR * uniforms.filterDims[1] + wC', similarly to the max-pooling
           // backward routines.
           for (var wR = 0; wR < uniforms.filterDims[0]; wR++) {
             let xR = dyCorner.x + wR * uniforms.dilations[0];

             if (xR >= 0 && xR < uniforms.xShape[1]) {
               for (var wC = 0; wC < uniforms.filterDims[1]; wC++) {
                 let xC = dyCorner.y + wC * uniforms.dilations[1];

                 if (xC >= 0 && xC < uniforms.xShape[2]) {
                   let val = getX(b, xR, xC, d) + getW(wR, wC, d);
                   if (val > curVal) {
                     curVal = val;
                     xRMax = xR;
                     xCMax = xC;
                   }
                 }
               }
             }
           }

           let flatIndexIn = d + uniforms.xShape[3] *
               (xCMax + uniforms.xShape[2] * (xRMax + uniforms.xShape[1] * b));
           let value = getDy(b, r, c, d);
           ${I("&result[flatIndexIn]","value",this.type)}
         }
       }
     `}}class ax{constructor(e,t,i){if(this.variableNames=["x","w","dy"],this.uniforms="filterDims: vec2<i32>, pads: vec2<i32>, strides: vec2<i32>, dilations: vec2<i32>, dySize: i32,",this.workgroupSize=[64,1,1],this.atomic=!0,this.outputShape=e.filterShape,this.dispatchLayout=U(e.outShape),this.dispatch=L(this.dispatchLayout,e.outShape,this.workgroupSize),"float32"!==i&&"int32"!==i)throw Error(`Dilation2DBackpropFilter only supports float32 and int32
          types, does not support ${i} type.`);this.type=i,this.shaderKey="dilation2DBackpropFilter"}getUserCode(){return`
       ${P("index")} {
         if (index < uniforms.dySize) {
           let coords = getDyCoordsFromIndex(index);
           let b = coords[0];
           let r = coords[1];
           let c = coords[2];
           let d = coords[3];

           let dyCorner = vec2<i32>(r, c) * uniforms.strides - uniforms.pads;
           var curVal = -3.4e38;  // neg_infinity
           var wRMax = 0;
           var wCMax = 0;

           // In the case of multiple argmax branches, we only back-propagate
           // along the last branch, i.e., the one with largest value of
           // 'wR * uniforms.filterDims[1] + wC', similarly to the max-pooling
           // backward routines.
           for (var wR = 0; wR < uniforms.filterDims[0]; wR++) {
             let xR = dyCorner.x + wR * uniforms.dilations[0];

             if (xR >= 0 && xR < uniforms.xShape[1]) {
               for (var wC = 0; wC < uniforms.filterDims[1]; wC++) {
                 let xC = dyCorner.y + wC * uniforms.dilations[1];

                 if (xC >= 0 && xC < uniforms.xShape[2]) {
                   let val = getX(b, xR, xC, d) + getW(wR, wC, d);
                   if (val > curVal) {
                     curVal = val;
                     wRMax = wR;
                     wCMax = wC;
                   }
                 }
               }
             }
           }

           let flatIndexIn = d + uniforms.wShape[2] * (wCMax + wRMax * uniforms.wShape[1]);
           let value = getDy(b, r, c, d);
           ${I("&result[flatIndexIn]","value",this.type)}
         }
       }
     `}}let ay={kernelName:Y.Dilation2DBackpropFilter,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a,filter:s,dy:o}=t,{strides:n,pad:u,dilations:l}=r,d=m.backend_util.computeDilation2DInfo(a.shape,s.shape,n,u,"NHWC",l),h=s.dtype,p=new ax(d,s.shape,h),c=[{type:"int32",data:[d.filterHeight,d.filterWidth]},{type:"int32",data:[d.padInfo.top,d.padInfo.left]},{type:"int32",data:[d.strideHeight,d.strideWidth]},{type:"int32",data:[d.dilationHeight,d.dilationWidth]},{type:"int32",data:[y.util.sizeFromShape(d.outShape)]}],f=eG({backend:i,attrs:{shape:s.shape,value:0,dtype:h}});return i.runWebGPUProgram(p,[a,s,o],h,c,f)}},aw={kernelName:Y.Dilation2DBackpropInput,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a,filter:s,dy:o}=t,{strides:n,pad:u,dilations:l}=r,d=m.backend_util.computeDilation2DInfo(a.shape,s.shape,n,u,"NHWC",l),h=a.dtype,p=new ag(d,h),c=[{type:"int32",data:[d.filterHeight,d.filterWidth]},{type:"int32",data:[d.padInfo.top,d.padInfo.left]},{type:"int32",data:[d.strideHeight,d.strideWidth]},{type:"int32",data:[d.dilationHeight,d.dilationWidth]},{type:"int32",data:[y.util.sizeFromShape(d.outShape)]}],f=eG({backend:i,attrs:{shape:d.inShape,value:0,dtype:h}});return i.runWebGPUProgram(p,[a,s,o],h,c,f)}};class ab{constructor(e,t,i){this.variableNames=["Image"],this.uniforms="alpha: f32,",this.workgroupSize=[64,1,1],this.pixelsOpType=n.DRAW,this.size=!0,this.outputShape=e,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.type=t,this.textureFormat=i,this.shaderKey=`draw_${t}_${i}`}getUserCode(){let e,t="float32"===this.type?"value":"value / 255.0";return e=`
      if (uniforms.numChannels == 1) {
        rgba[0] = ${t};
        rgba[1] = ${t};
        rgba[2] = ${t};
      } else {
        rgba[d] = ${t};
      }`,`
       @group(0) @binding(0) var outImage : texture_storage_2d<${this.textureFormat}, write>;
       ${P("index")} {
         if (index < uniforms.size) {
           var rgba = vec4<f32>(0.0, 0.0, 0.0, uniforms.alpha);
           for (var d = 0; d < uniforms.numChannels; d = d + 1) {
             let value = f32(inBuf[index * uniforms.numChannels + d]);
             ${e}
           }
           rgba.x = rgba.x * rgba.w;
           rgba.y = rgba.y * rgba.w;
           rgba.z = rgba.z * rgba.w;
           let coords = getCoordsFromIndex(index);
           textureStore(outImage, vec2<i32>(coords.yx), rgba);
         }
       }
      `}}let aC={kernelName:Y.Draw,backendName:"webgpu",kernelFunc:function(e){let t,{inputs:i,backend:r,attrs:a}=e,{image:s}=i,{canvas:o,options:n}=a,[u,l]=s.shape.slice(0,2),{imageOptions:d}=n||{},h=(null==d?void 0:d.alpha)||1,p=r.device.features.has("bgra8unorm-storage")?"bgra8unorm":"rgba8unorm",c=[u,l],f=new ab(c,s.dtype,p);o.width=l,o.height=u;let m="webgpu",g=o.getContext(m);g||(g=(t=new OffscreenCanvas(l,u)).getContext(m));let x=3===s.shape.length?s.shape[2]:1;g.configure({device:r.device,format:p,usage:GPUTextureUsage.STORAGE_BINDING,alphaMode:"premultiplied"});let y="int32",w=r.makeTensorInfo(c,y),b=r.tensorMap.get(w.dataId);if(b.resource=g.getCurrentTexture(),b.external=!0,r.runWebGPUProgram(f,[s],y,[{type:"uint32",data:[x]},{type:"float32",data:[h]}],w),t){let e=o.getContext("2d");if(!e)throw Error("Please make sure this canvas has only been used for 2d or webgpu context!");e.drawImage(t,0,0)}return r.disposeData(w.dataId),s}},aS=e6({opType:l.MUL,cpuKernelImpl:ir,supportsComplex:!0}),av={kernelName:Y.Multiply,backendName:"webgpu",kernelFunc:aS};function aI(e){let{inputs:t,backend:i,attrs:r}=e,{x:a}=t,{axis:s,keepDims:o}=r;return iB(a,s,o,"sum",i)}let ak={kernelName:Y.Sum,backendName:"webgpu",kernelFunc:aI},aR={kernelName:Y.Einsum,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{equation:a}=r,{allDims:s,summedDims:o,idDims:n}=m.backend_util.decodeEinsumEquation(a,t.length);m.backend_util.checkEinsumDimSizes(s.length,n,t);let{path:u,steps:l}=m.backend_util.getEinsumComputePath(o,n),d=l.length,h=null,p=s.length,c=[];for(let e=0;e<d;++e){for(let r of l[e]){let e,{permutationIndices:a,expandDims:s}=m.backend_util.getEinsumPermutation(p,n[r]);m.backend_util.isIdentityPermutation(a)?e=t[r]:(e=iF({inputs:{x:t[r]},backend:i,attrs:{perm:a}}),c.push(e));let o=e.shape.slice();for(let e=0;e<s.length;++e)o.splice(s[e],0,1);y.util.arraysEqual(e.shape,o)||(e=eX({inputs:{x:e},backend:i,attrs:{shape:o}}),c.push(e)),null===h?h=e:(h=aS({inputs:{a:e,b:h},backend:i}),c.push(h))}e<d-1&&(u[e]>=0&&(h=aI({inputs:{x:h},backend:i,attrs:{axis:u[e]-(s.length-p),keepDims:!1}}),c.push(h)),p--)}for(let e of c)e!==h&&i.disposeData(e.dataId);return h}},a$=e4({opType:d.ELU}),aP={kernelName:Y.Elu,backendName:"webgpu",kernelFunc:a$},az={kernelName:Y.EluGrad,backendName:"webgpu",kernelFunc:e=>{let{inputs:t,backend:i}=e,{dy:r,y:a}=t,s=new eZ(l.ELU_DER,r.shape,a.shape);return i.runWebGPUProgram(s,[r,a],r.dtype)}},aA=e6({opType:l.EQUAL,dtype:"bool",cpuKernelImpl:tZ}),aN={kernelName:Y.Equal,backendName:"webgpu",kernelFunc:aA},aD=e4({opType:d.ERF}),aT={kernelName:Y.Erf,backendName:"webgpu",kernelFunc:aD},aF=e4({opType:d.EXP,cpuKernelImpl:tJ,dtype:"float32"}),a_={kernelName:Y.Exp,backendName:"webgpu",kernelFunc:aF};function aE(e){let{inputs:t,attrs:i,backend:r}=e,{dim:a}=i,{input:s}=t,o=s.shape.length,n=s.shape.slice(),u=a;return a<0&&(y.util.assert(-(o+1)<=a,()=>`Axis must be in the interval [${-(o+1)}, ${o}]`),u=o+a+1),n.splice(u,0,1),eX({inputs:{x:s},backend:r,attrs:{shape:n}})}let aL={kernelName:Y.ExpandDims,backendName:"webgpu",kernelFunc:aE},aB=e4({opType:d.EXPM1,cpuKernelImpl:t2}),aW={kernelName:Y.Expm1,backendName:"webgpu",kernelFunc:aB};class aO{constructor(e,t){this.variableNames=["real","imag"],this.outputShape=[],this.uniforms="exponentMultiplier : f32, denominator: f32,",this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=t,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.component=e,this.shaderKey=`fft_${e}`}getUserCode(){let e="real"===this.component?"return real * expR - imag * expI;":"return real * expI + imag * expR;";return`
    fn unaryOpComplex(real: f32, expR: f32, imag: f32, expI: f32) -> f32 {
      ${e}
    }

    fn mulMatDFT(batch: i32, index: i32) -> f32 {
      let indexRatio = f32(index) / f32(uniforms.realShape[1]);
      let exponentMultiplierTimesIndexRatio =
          uniforms.exponentMultiplier * indexRatio;

      var result = 0.0;

      for (var i = 0; i < uniforms.realShape[1]; i = i + 1) {
        // x = (-2|2 * PI / N) * index * i;
        let x = exponentMultiplierTimesIndexRatio * f32(i);
        let expR = cos(x);
        let expI = sin(x);
        let real = getReal(batch, i);
        let imag = getImag(batch, i);

        result = result +
            unaryOpComplex(real, expR, imag, expI) / uniforms.denominator;
      }

      return result;
    }

    ${P("index")} {
      if (index < uniforms.size) {
        let coords = getOutputCoords();
        setOutputAtIndex(index, mulMatDFT(coords[0], coords[1]));
      }
    }
  `}}function aU(e,t,i){let r=i.tensorMap.get(e.dataId),a=y.util.sizeFromShape(e.shape),s=e.shape[e.shape.length-1],o=[],n=eX({inputs:{x:e},backend:i,attrs:{shape:[a/s,s]}});o.push(n);let u=n.shape,l=new aO("real",u),d=new aO("imag",u),h=[{dataId:r.complexTensorInfos.real.dataId,dtype:r.complexTensorInfos.real.dtype,shape:u},{dataId:r.complexTensorInfos.imag.dataId,dtype:r.complexTensorInfos.imag.dtype,shape:u}],p=[{type:"float32",data:[t?2*Math.PI:-2*Math.PI]},{type:"float32",data:[t?u[1]:1]}],c=i.runWebGPUProgram(l,h,"float32",p);o.push(c);let f=i.runWebGPUProgram(d,h,"float32",p);o.push(f);let m=e0({inputs:{real:c,imag:f},backend:i});o.push(m);let g=eX({inputs:{x:m},backend:i,attrs:{shape:e.shape}});return o.forEach(e=>i.disposeData(e.dataId)),g}let aM={kernelName:Y.FFT,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i}=e,{input:r}=t;return aU(r,!1,i)}};class aV{constructor(e){this.outputShape=[],this.variableNames=["x"],this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.shaderKey="flipLeftRight"}getUserCode(){return`
      ${P("index")} {
        if (index < uniforms.size) {
          let coords = getCoordsFromIndex(index);
          let coordX = uniforms.xShape[2] - coords[2] - 1;
          let outputValue = getX(coords[0], coords[1], coordX, coords[3]);
          setOutputAtIndex(index, outputValue);
        }
      }
    `}}let aG={kernelName:Y.FlipLeftRight,backendName:"webgpu",kernelFunc:({inputs:e,backend:t})=>{let{image:i}=e,r=new aV(i.shape);return t.runWebGPUProgram(r,[i],i.dtype)}},aH=e4({opType:d.FLOOR,cpuKernelImpl:t0}),aX={kernelName:Y.Floor,backendName:"webgpu",kernelFunc:aH},aK=e6({opType:l.FLOOR_DIV,cpuKernelImpl:t1,dtype:"int32"}),aq={kernelName:Y.FloorDiv,backendName:"webgpu",kernelFunc:aK};class aY{constructor(e,t,i=!1){this.pixelsOpType=n.FROM_PIXELS,this.outputShape=[0],this.variableNames=[],this.workgroupSize=[256,1,1],this.outputShape=e,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize,[t,1,1]),this.importVideo=i,this.shaderKey=`fromPixels_${this.importVideo}`}getUserCode(){let e=this.importVideo?"textureLoad(src, vec2<i32>(coords.yx));":"textureLoad(src, vec2<i32>(coords.yx), 0)",t=this.importVideo?"texture_external":"texture_2d<f32>";return`
      @binding(1) @group(0) var src: ${t};
      ${P("index")} {
        let flatIndex = index * uniforms.numChannels;
        if (flatIndex < uniforms.size) {
          let coords = getCoordsFromIndex(flatIndex);
          let values = ${e};
          for (var i = 0; i < uniforms.numChannels; i = i + 1) {
            result[flatIndex + i] = i32(floor(255.0 * values[i]));
          }
        }
      }
  `}}let aj={kernelName:Y.FromPixels,backendName:"webgpu",kernelFunc:function(e){let{inputs:i,backend:r,attrs:a}=e,{pixels:s}=i,{numChannels:o}=a;if(null==s)throw Error("pixels passed to tf.browser.fromPixels() can not be null");let n="u">typeof HTMLVideoElement&&s instanceof HTMLVideoElement,u="u">typeof HTMLImageElement&&s instanceof HTMLImageElement,l="u">typeof HTMLCanvasElement&&s instanceof HTMLCanvasElement||"u">typeof OffscreenCanvas&&s instanceof OffscreenCanvas,d="u">typeof ImageBitmap&&s instanceof ImageBitmap,[h,c]=n?[s.videoWidth,s.videoHeight]:[s.width,s.height],f=[c,h,o],m=(0,p.env)().getBool("WEBGPU_IMPORT_EXTERNAL_TEXTURE")&&n,g=n||u;if(d||l||g){let e;if(m)e=r.device.importExternalTexture({source:s});else{if(g){let e=(0,p.env)().getBool("CANVAS2D_WILL_READ_FREQUENTLY_FOR_GPU");(null==t||e!==aQ)&&(aQ=e,t=document.createElement("canvas").getContext("2d",{willReadFrequently:aQ})),t.canvas.width=h,t.canvas.height=c,t.drawImage(s,0,0,h,c),s=t.canvas}let i=GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING,a=r.textureManager.acquireTexture(f[1],f[0],"rgba8unorm",i);r.queue.copyExternalImageToTexture({source:s},{texture:a},[f[1],f[0]]),e=a}let i=y.util.sizeFromShape(f),a=y.util.computeStrides(f),n=new aY(f,o,m),u=[{type:"uint32",data:[i]},{type:"uint32",data:[o]},{type:"uint32",data:[...a]}],l=r.makeTensorInfo([c,h],"int32");r.tensorMap.get(l.dataId).resource=e;let d=r.runWebGPUProgram(n,[l],"int32",u);return r.disposeData(l.dataId),d}let x=s.data,w=x;if(null!=o&&4!==o){w=new Uint8Array(s.width*s.height*o);let e=x.length,t=0;for(let i=0;i<e;i++)i%4<o&&(w[t++]=x[i])}let b=r.makeTensorInfo(f,"int32",new Int32Array(w));return r.uploadToGPU(b.dataId),b}},aQ=(0,p.env)().getBool("CANVAS2D_WILL_READ_FREQUENTLY_FOR_GPU");class aZ{constructor(e,t,i,r,a){this.uniforms="varianceEpsilon : f32,",this.workgroupSize=[128,1,1],this.size=!0,this.variableNames=["x","mean","variance"],m.backend_util.assertAndGetBroadcastShape(e,t),m.backend_util.assertAndGetBroadcastShape(e,i),this.outputShape=e,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),null!=r&&(m.backend_util.assertAndGetBroadcastShape(e,r),this.variableNames.push("offset")),null!=a&&(m.backend_util.assertAndGetBroadcastShape(e,a),this.variableNames.push("scale")),this.offsetShape=r,this.scaleShape=a,this.shaderKey="batchNorm"}getUserCode(){let e="0.0";null!=this.offsetShape&&(e="getOffsetByOutputIndex(index)");let t="1.0";return null!=this.scaleShape&&(t="getScaleByOutputIndex(index)"),`
      ${P("index")} {
        if (index < uniforms.size)
        {
          let xValue = getXByOutputIndex(index);
          let meanValue = getMeanByOutputIndex(index);
          let varianValue = getVarianceByOutputIndex(index);
          let offsetValue = ${e};
          let scaleValue = ${t};
          let inv = scaleValue * inverseSqrt(varianValue + f32(uniforms.varianceEpsilon));
          setOutputAtIndex(index,dot(vec3<f32>(xValue, -meanValue, offsetValue), vec3<f32>(inv, inv, 1.0)));
        }
      }
  `}}let aJ={kernelName:Y.FusedBatchNorm,backendName:"webgpu",kernelFunc:({inputs:e,attrs:t,backend:i})=>{let{x:r,scale:a,offset:s,mean:o,variance:n}=e,{varianceEpsilon:u}=t,l=[r,o,n],d=null;null!=s&&(d=s.shape,l.push(s));let h=null;null!=a&&(h=a.shape,l.push(a));let p=new aZ(r.shape,o.shape,n.shape,d,h);return i.runWebGPUProgram(p,l,r.dtype,[{type:"float32",data:[u]}])}},a2={kernelName:Y.FusedConv2D,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a,filter:s,bias:o,preluActivationWeights:n}=t,{strides:u,pad:l,dataFormat:d,dilations:h,dimRoundingMode:p,activation:c,leakyreluAlpha:f}=r,g=m.backend_util.convertConv2DDataFormat(d),x=m.backend_util.computeConv2DInfo(a.shape,s.shape,u,h,l,p,!1,g);return rO({x:a,filter:s,convInfo:x,backend:i,bias:o,preluActivationWeights:n,leakyreluAlpha:f,activation:c})}},a0={kernelName:Y.FusedDepthwiseConv2D,backendName:"webgpu",kernelFunc:function(e){let t,{inputs:i,backend:r,attrs:a}=e,{x:s,filter:o,bias:n,preluActivationWeights:u}=i,{strides:l,pad:d,dilations:h,dimRoundingMode:p,activation:c,leakyreluAlpha:f}=a,g=h;null==g&&(g=[1,1]),y.util.assert(m.backend_util.eitherStridesOrDilationsAreOne(l,g),()=>`Error in depthwiseConv2d: Either strides or dilations must be 1. Got strides ${l} and dilations '${g}'`);let x=m.backend_util.computeConv2DInfo(s.shape,o.shape,l,g,d,p,!0),w=[s,o],b=null!=n,C=null!=u;b&&w.push(n),C&&w.push(u);let S=[{type:"int32",data:[x.padInfo.top,x.padInfo.left]},{type:"int32",data:[x.inHeight,x.inWidth]}];return x.outHeight>4&&x.outWidth>4&&x.strideWidth<=2&&x.inChannels===x.outChannels&&1===x.dilationHeight&&1===x.dilationWidth&&x.inChannels%4==0?(t=new as(x,b,c,C),S.push({type:"int32",data:[t.virtualWidth]})):(t=new ao(x,b,c,C),S.push({type:"int32",data:[x.filterHeight]},{type:"int32",data:[x.filterWidth]},{type:"int32",data:[x.strideHeight,x.strideWidth]},{type:"int32",data:[x.dilationHeight,x.dilationWidth]})),"leakyrelu"===c&&(S.push({type:"float32",data:[f]}),t.uniforms+=" alpha : f32,"),r.runWebGPUProgram(t,w,"float32",S)}};class a1{constructor(e,t){this.variableNames=["A","indices"],this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=t,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.shaderKey=`gathernd_${e}`,this.sliceDim=e,this.uniforms=`sliceDim : i32, strides : ${R(e)},`}getUserCode(){let e;return e=this.sliceDim>1?"uniforms.strides[j]":"uniforms.strides",`
      ${P("index")} {
        if (index < uniforms.size) {
          let coords = getCoordsFromIndex(index);
          var flattenIndex = 0;
          for (var j = 0; j < uniforms.sliceDim; j = j + 1) {
            let indexTemp = i32(round(getIndices(coords[0], j)));
            let strideNum = ${e};
            flattenIndex = flattenIndex + indexTemp * strideNum;
          }

          setOutputAtIndex(index, getA(flattenIndex, coords[1]));
        }
      }
      `}}let a3={kernelName:Y.GatherNd,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i}=e,{params:r,indices:a}=t,s=a.shape,o=s[s.length-1],n=y.util.sizeFromShape(r.shape),[u,l,d,h]=m.backend_util.prepareAndValidate(r,a),p=eX({inputs:{x:a},backend:i,attrs:{shape:[l,o]}}),c=eX({inputs:{x:r},backend:i,attrs:{shape:[y.util.sizeFromShape(r.shape)/d,d]}});if(i.shouldExecuteOnCPU([r,a])||"string"===r.dtype){let e=t3(i.readSync(a.dataId),i.bufferSync(r),r.dtype,l,o,d,h,r.shape,n);return i.makeTensorInfo(u,r.dtype,e.values)}let f=new a1(o,[l,d]),g=[{type:"int32",data:[o]},{type:"int32",data:h}],x=i.runWebGPUProgram(f,[c,p],c.dtype,g),w=eX({inputs:{x:x},backend:i,attrs:{shape:u}});return i.disposeData(p.dataId),i.disposeData(c.dataId),i.disposeData(x.dataId),w}};class a4{constructor(e,t){this.variableNames=["A","indices"],this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e.slice(),this.aShape=e,this.outputShape=t,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.shaderKey="gather"}getUserCode(){let e=function(e){let t=["resRC.x","resRC.y","resRC.z","resRC.w"],i=[];for(let r=0;r<e.length;r++)2===r?i.push("indexZ"):i.push(`${t[r]}`);return i.join()}(this.aShape);return`
      ${P("index")} {
        if (index < uniforms.size) {
          let resRC = getCoordsFromIndex(index);
          let indexZ = i32(getIndices(resRC.x, resRC.z));
          let inBounds = select(0.0, 1.0, indexZ >= 0 && indexZ < uniforms.aShape[2]);
          setOutputAtIndex(index, inBounds * getA(${e}));
        }
      }
    `}}function a6(e){let{inputs:t,backend:i,attrs:r}=e,{x:a,indices:s}=t,{axis:o,batchDims:n}=r,u=y.util.parseAxisParam(o,a.shape)[0],l=m.backend_util.segment_util.collectGatherOpShapeInfo(a,s,u,n),d=y.util.sizeFromShape(s.shape),h=[],p=eX({inputs:{x:a},backend:i,attrs:{shape:[l.batchSize,l.outerSize,l.dimSize,l.sliceSize]}}),c=eX({inputs:{x:s},backend:i,attrs:{shape:[l.batchSize,d/l.batchSize]}});h.push(p),h.push(c);let f=[l.batchSize,l.outerSize,d/l.batchSize,l.sliceSize];if(i.shouldExecuteOnCPU([a,s])){let e=i.tensorMap.get(c.dataId).values,t=(0,g.buffer)(c.shape,c.dtype,e),r=i.tensorMap.get(p.dataId).values,a=t4((0,g.buffer)(p.shape,p.dtype,r),t,f);return h.forEach(e=>i.disposeData(e.dataId)),i.makeTensorInfo(l.outputShape,a.dtype,a.values)}let x=new a4(p.shape,f),w=i.runWebGPUProgram(x,[p,c],p.dtype);h.push(w);let b=eX({inputs:{x:w},backend:i,attrs:{shape:l.outputShape}});return h.forEach(e=>i.disposeData(e.dataId)),b}let a5={kernelName:Y.GatherV2,backendName:"webgpu",kernelFunc:a6},a8=e6({opType:l.GREATER,cpuKernelImpl:t5,dtype:"bool"}),a9={kernelName:Y.Greater,backendName:"webgpu",kernelFunc:a8},a7=e6({opType:l.GREATER_EQUAL,dtype:"bool",cpuKernelImpl:t6}),se={kernelName:Y.GreaterEqual,backendName:"webgpu",kernelFunc:a7},st={kernelName:Y.IFFT,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i}=e,{input:r}=t;return aU(r,!0,i)}},si=e4({opType:d.IS_FINITE,dtype:"bool"}),sr={kernelName:Y.IsFinite,backendName:"webgpu",kernelFunc:si},sa=e4({opType:d.IS_INF,dtype:"bool"}),ss={kernelName:Y.IsInf,backendName:"webgpu",kernelFunc:sa},so=e4({opType:d.IS_NAN,dtype:"bool"}),sn={kernelName:Y.IsNan,backendName:"webgpu",kernelFunc:so},su={kernelName:Y.LeakyRelu,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a}=t,{alpha:s}=r,o=new e3(a.shape,d.LEAKYRELU,"alpha : f32,");return i.runWebGPUProgram(o,[a],"float32",[{type:"float32",data:[s]}])}},sl=e6({opType:l.LESS,dtype:"bool",cpuKernelImpl:t9}),sd={kernelName:Y.Less,backendName:"webgpu",kernelFunc:sl},sh=e6({opType:l.LESS_EQUAL,dtype:"bool",cpuKernelImpl:t8}),sp={kernelName:Y.LessEqual,backendName:"webgpu",kernelFunc:sh};class sc{constructor(e){this.variableNames=[],this.outputShape=[],this.uniforms="start : f32, step : f32,",this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=[e],this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.shaderKey="linSpace"}getUserCode(){return`
      ${P("index")} {
        if (index < uniforms.size) {
          setOutputAtIndex(index, uniforms.start + f32(index) * uniforms.step);
        }
      }
    `}}let sf={kernelName:Y.LinSpace,backendName:"webgpu",kernelFunc:function(e){let{backend:t,attrs:i}=e,{start:r,stop:a,num:s}=i,o=(a-r)/(s-1),n=new sc(s);return t.runWebGPUProgram(n,[],"float32",[{type:"float32",data:[r]},{type:"float32",data:[o]}])}},sm=e4({opType:d.LOG,cpuKernelImpl:t7}),sg={kernelName:Y.Log,backendName:"webgpu",kernelFunc:sm},sx=e4({opType:d.LOG1P}),sy={kernelName:Y.Log1p,backendName:"webgpu",kernelFunc:sx},sw=e6({opType:l.LOGICAL_AND,dtype:"bool"}),sb={kernelName:Y.LogicalAnd,backendName:"webgpu",kernelFunc:sw},sC=e4({opType:d.LOGICAL_NOT}),sS={kernelName:Y.LogicalNot,backendName:"webgpu",kernelFunc:sC},sv=e6({opType:l.LOGICAL_OR}),sI={kernelName:Y.LogicalOr,backendName:"webgpu",kernelFunc:sv},sk=`
  var powValue = 0.0;
  let basis = uniforms.bias + uniforms.alpha * sum;
  if (uniforms.beta == 0.5) {
    powValue = inverseSqrt(basis);
  } else if (uniforms.beta == 1.0) {
    powValue = 1.0 / basis;
  } else {
    powValue = exp(log(basis) * (-uniforms.beta));
  }
`;class sR{constructor(e){this.outputShape=[],this.variableNames=["x"],this.uniforms="radius : i32, bias : f32, alpha : f32, beta : f32,",this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.shaderKey="lrn"}getUserCode(){return`
    ${P("index")} {
      if (index < uniforms.size) {
        let coords = getOutputCoords();
        let b = coords[0];
        let r = coords[1];
        let c = coords[2];
        let d = coords[3];

        let x = getX(b, r, c, d);
        var sum = 0.0;
        for (var i = -uniforms.radius; i <= uniforms.radius; i = i + 1) {
          let idx = d + i;
          if (idx >= 0 && idx < uniforms.xShape[3]) {
            let z = getX(b, r, c, idx);
            sum = sum + z * z;
          }
        }
        ${sk}

        setOutputAtIndex(index, x * powValue);
      }
    }
  `}}class s${constructor(e,t){this.outputShape=[],this.variableNames=["x"],this.uniforms="radius : i32, bias : f32, alpha : f32, beta : f32,",this.workgroupSize=[256,1,1],this.maxAllowRadius=16,y.util.assert(t<=this.maxAllowRadius,()=>`Radius must be less than or equal to ${this.maxAllowRadius}, current radius is ${t}`),this.outputShape=e,this.elementsPerWorkgroup=this.workgroupSize[0]-2*this.maxAllowRadius,this.dispatchLayout={x:[3],y:[2],z:[0,1]},this.dispatch=L(this.dispatchLayout,this.outputShape,[this.elementsPerWorkgroup,this.workgroupSize[1],this.workgroupSize[2]]),this.shaderKey="lrn_shared"}getUserCode(){return`
    var <workgroup>lrnSub: array<f32, ${this.workgroupSize[0]}>;
    const elementsPerWorkgroup = ${this.elementsPerWorkgroup};
    const maxAllowRadius = ${this.maxAllowRadius};

    ${P()} {
      let localDepth = i32(localId.x);
      let workgroupDepth = i32(workgroupId.x) * elementsPerWorkgroup;
      let xDepth = workgroupDepth + localDepth - maxAllowRadius;
      let b = i32(globalId.z) / uniforms.xShape[1];
      let r = i32(globalId.z) - b * uniforms.xShape[1];
      let c = i32(globalId.y);
      let d = workgroupDepth + localDepth;

      var x = 0.0;
      if (xDepth >= 0 && xDepth < uniforms.xShape[3]) {
        x = getX(b, r, c, xDepth);
      }
      lrnSub[localDepth] = x;
      workgroupBarrier();

      if (localDepth < elementsPerWorkgroup && d < uniforms.outShape[3]) {
        var sum = 0.0;
        let index = localDepth + maxAllowRadius;
        for (var i = -uniforms.radius; i <= uniforms.radius; i = i + 1) {
          let z = lrnSub[index + i];
          sum = sum + z * z;
        }
        ${sk}

        setOutputAtCoords(b, r, c, d, lrnSub[index] * powValue);
      }
    } `}}let sP={kernelName:Y.LRN,backendName:"webgpu",kernelFunc:function(e){let t,{inputs:i,backend:r,attrs:a}=e,{x:s}=i,{depthRadius:o,bias:n,alpha:u,beta:l}=a;t=o>16?new sR(s.shape):new s$(s.shape,o);let d=[{type:"int32",data:[o]},{type:"float32",data:[n]},{type:"float32",data:[u]},{type:"float32",data:[l]}];return r.runWebGPUProgram(t,[s],s.dtype,d)}};class sz{constructor(e){this.outputShape=[],this.variableNames=["inputImage","outputImage","dy"],this.uniforms="depthRadius : i32, bias : f32, alpha : f32, beta : f32,",this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.shaderKey="lrn_grad"}getUserCode(){return`
    ${P("index")} {
      if (index < uniforms.size) {
        let coords = getOutputCoords();
        let b = coords[0];
        let r = coords[1];
        let c = coords[2];

        let MIN_DEPTH_BEGIN = 0;
        let MAX_DEPTH_END = uniforms.outShape[3];
        var result = 0.0;
        for (var d = MIN_DEPTH_BEGIN; d < MAX_DEPTH_END; d++) {
          let depthBegin = max(MIN_DEPTH_BEGIN, d - uniforms.depthRadius);
          let depthEnd = min(MAX_DEPTH_END, d + uniforms.depthRadius + 1);

          var norm = 0.0;
          for (var k = MIN_DEPTH_BEGIN; k < MAX_DEPTH_END; k++) {
            if (k < depthBegin) {
              continue;
            } else if (k >= depthBegin && k < depthEnd) {
              norm += getInputImage(b, r, c, k) * getInputImage(b, r, c, k);
            } else {
              break;
            }
          }

          norm = uniforms.alpha * norm + uniforms.bias;

          for (var k = MIN_DEPTH_BEGIN; k < MAX_DEPTH_END; k++) {
            if (k < depthBegin) {
              continue;
            } else if (k >= depthBegin && k < depthEnd) {
              var dyi = -2.0 * uniforms.alpha * uniforms.beta
                * getInputImage(b, r, c, k) * getOutputImage(b, r, c, d) / norm;
              if (k == d) {
                dyi += pow(norm, -1.0 * uniforms.beta);
              }
              if (k == coords[3]) {
                dyi *= getDy(b, r, c, d);
                result += dyi;
              }
            } else {
              break;
            }
          }
        }

        setOutputAtIndex(index, result);
      }
    }
  `}}let sA={kernelName:Y.LRNGrad,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a,y:s,dy:o}=t,{depthRadius:n,bias:u,alpha:l,beta:d}=r,h=new sz(a.shape);return i.runWebGPUProgram(h,[a,s,o],a.dtype,[{type:"int32",data:[n]},{type:"float32",data:[u]},{type:"float32",data:[l]},{type:"float32",data:[d]}])}},sN=e6({opType:l.MAX,cpuKernelImpl:it}),sD={kernelName:Y.Maximum,backendName:"webgpu",kernelFunc:sN},sT={kernelName:Y.MaxPool,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a}=t,{filterSize:s,strides:o,pad:n,dimRoundingMode:u}=r,l=m.backend_util.computePool2DInfo(a.shape,s,o,1,n,u);return i8(a,l,"max",i)}},sF={kernelName:Y.MaxPool3D,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a}=t,{filterSize:s,strides:o,pad:n,dataFormat:u,dimRoundingMode:l}=r,d=m.backend_util.computePool3DInfo(a.shape,s,o,[1,1,1],n,l,u),h=new i1(d,"max"),p=[{type:"int32",data:[d.strideDepth,d.strideHeight,d.strideWidth]},{type:"int32",data:[d.padInfo.front,d.padInfo.top,d.padInfo.left]},{type:"int32",data:[d.inDepth,d.inHeight,d.inWidth]},{type:"int32",data:[d.effectiveFilterDepth,d.effectiveFilterHeight,d.effectiveFilterWidth]}];return i.runWebGPUProgram(h,[a],a.dtype,p)}};class s_{constructor(e){this.variableNames=["dy","maxPos"],this.uniforms=`strides : vec2<i32>, pads : vec2<i32>, dilations : vec2<i32>, filterDims : vec2<i32>,
       outHeight : i32, outWidth : i32`,this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e.inShape,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.shaderKey="maxPool2DBackprop"}getUserCode(){return`
      ${P("index")} {
      if (index < uniforms.size) {
        let coords = getCoordsFromIndex(index);
        let batch = coords[0];
        let d = coords[3];

        let dyRCCorner = vec2<i32>(coords.yz) - uniforms.pads;
        let dyRCorner = dyRCCorner.x;
        let dyCCorner = dyRCCorner.y;

        // Convolve dy(?, ?, d) with pos mask(:, :, d) to get dx(xR, xC, d).
        // ? = to be determined. : = across all values in that axis.
        var dotProd = 0.0;
        let lastIndex = uniforms.filterDims[0] * uniforms.filterDims[1] - 1;
        for (var wR = 0; wR < uniforms.filterDims[0]; wR += uniforms.dilations[0]) {
          let dyR = f32(dyRCorner + wR) / f32(uniforms.strides[0]);

          if (dyR < 0.0 || dyR >= f32(uniforms.outHeight) || fract(dyR) > 0.0) {
            continue;
          }
          let idyR = i32(dyR);

          for (var wC = 0; wC < uniforms.filterDims[1]; wC += uniforms.dilations[1]) {
            let dyC = f32(dyCCorner + wC) / f32(uniforms.strides[1]);

            if (dyC < 0.0 || dyC >= f32(uniforms.outWidth) || fract(dyC) > 0.0) {
              continue;
            }
            let idyC = i32(dyC);

            let dyValue = getDy(batch, idyR, idyC, d);
            let maxPosValue = lastIndex - i32(getMaxPos(batch, idyR, idyC, d));

            // Get the current value, check it against the value from the
            // position matrix.
            let curPosValue = wR * uniforms.filterDims[1] + wC;
            let mask = select(0.0, 1.0, maxPosValue == curPosValue);
            dotProd += dyValue * mask;
          }
        }
        setOutputAtIndex(index, dotProd);
      }
    }
    `}}class sE{constructor(e){this.variableNames=["dy","maxPos"],this.uniforms=`strides : vec3<i32>, pads : vec3<i32>, filterDims : vec3<i32>,
      outDepth : i32, outHeight : i32, outWidth : i32`,this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e.inShape,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.shaderKey="maxPool3DBackprop"}getUserCode(){return`
      ${P("index")} {
      if (index < uniforms.size) {
        let coords = getCoordsFromIndex(index);
        let batch = coords.x;
        let ch = coords.u;

        let dyCorner = vec3<i32>(coords.y, coords.z, coords.w) - uniforms.pads;
        let dyDCorner = dyCorner.x;
        let dyRCorner = dyCorner.y;
        let dyCCorner = dyCorner.z;

        // Convolve dy(?, ?, ?, ch) with pos mask(:, :, :, d) to get
        // dx(xD, xR, xC, ch).
        // ? = to be determined. : = across all values in that axis.
        var dotProd = 0.0;
        let lastIndex = uniforms.filterDims[0] * uniforms.filterDims[1] * uniforms.filterDims[2] - 1;

        for (var wD = 0; wD < uniforms.filterDims[0]; wD++) {
          let dyD = f32(dyDCorner + wD) / f32(uniforms.strides[0]);

          if (dyD < 0.0 || dyD >= f32(uniforms.outDepth) || fract(dyD) > 0.0) {
            continue;
          }
          let idyD = i32(dyD);

          for (var wR = 0; wR < uniforms.filterDims[1]; wR++) {
            let dyR = f32(dyRCorner + wR) / f32(uniforms.strides[1]);

            if (dyR < 0.0 || dyR >= f32(uniforms.outHeight) || fract(dyR) > 0.0) {
              continue;
            }
            let idyR = i32(dyR);

            for (var wC = 0; wC < uniforms.filterDims[2]; wC++) {
              let dyC = f32(dyCCorner + wC) / f32(uniforms.strides[2]);

              if (dyC < 0.0 || dyC >= f32(uniforms.outWidth) || fract(dyC) > 0.0) {
                continue;
              }
              let idyC = i32(dyC);

              let dyValue = getDy(batch, idyD, idyR, idyC, ch);
              let maxPosValue = lastIndex - i32(getMaxPos(batch, idyD, idyR, idyC, ch));

              // Get the current value, check it against the value from the
              // position matrix.
              let curPosValue = wD * uniforms.filterDims[1] * uniforms.filterDims[2] + wR * uniforms.filterDims[2] + wC;
              let mask = select(0.0, 1.0, maxPosValue == curPosValue);
              dotProd += dyValue * mask;
            }
          }
        }

        setOutputAtIndex(index, dotProd);
      }
    }
    `}}let sL={kernelName:Y.MaxPool3DGrad,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{dy:a,input:s}=t,{filterSize:o,strides:n,pad:u,dimRoundingMode:l}=r,d=m.backend_util.computePool3DInfo(s.shape,o,n,[1,1,1],u,l),h=new i1(d,"max",!0),p=[{type:"int32",data:[d.strideDepth,d.strideHeight,d.strideWidth]},{type:"int32",data:[d.padInfo.front,d.padInfo.top,d.padInfo.left]},{type:"int32",data:[d.inDepth,d.inHeight,d.inWidth]},{type:"int32",data:[d.effectiveFilterDepth,d.effectiveFilterHeight,d.effectiveFilterWidth]}],c=i.runWebGPUProgram(h,[s],"int32",p),f=new sE(d);p=[{type:"int32",data:[d.strideDepth,d.strideHeight,d.strideWidth]},{type:"int32",data:[d.effectiveFilterDepth-1-d.padInfo.front,d.effectiveFilterHeight-1-d.padInfo.top,d.effectiveFilterWidth-1-d.padInfo.left]},{type:"int32",data:[d.effectiveFilterDepth,d.effectiveFilterHeight,d.effectiveFilterWidth]},{type:"int32",data:[d.outDepth]},{type:"int32",data:[d.outHeight]},{type:"int32",data:[d.outWidth]}];let g=i.runWebGPUProgram(f,[a,c],s.dtype,p);return i.disposeData(c.dataId),g}},sB={kernelName:Y.MaxPoolGrad,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{dy:a,input:s,output:o}=t;G([s,o],"maxPoolGrad");let{filterSize:n,strides:u,pad:l,dimRoundingMode:d}=r,h=m.backend_util.computePool2DInfo(s.shape,n,u,1,l,d),p=new i0(h,"max",!0),c=[{type:"int32",data:[h.strideHeight,h.strideWidth]},{type:"int32",data:[h.padInfo.top,h.padInfo.left]},{type:"int32",data:[h.dilationHeight,h.dilationWidth]},{type:"int32",data:[h.inHeight,h.inWidth]},{type:"int32",data:[h.effectiveFilterHeight,h.effectiveFilterWidth]}],f=i.runWebGPUProgram(p,[s],"int32",c),g=new s_(h);c=[{type:"int32",data:[h.strideHeight,h.strideWidth]},{type:"int32",data:[h.effectiveFilterHeight-1-h.padInfo.top,h.effectiveFilterWidth-1-h.padInfo.left]},{type:"int32",data:[h.dilationHeight,h.dilationWidth]},{type:"int32",data:[h.effectiveFilterHeight,h.effectiveFilterWidth]},{type:"int32",data:[h.outHeight]},{type:"int32",data:[h.outWidth]}];let x=i.runWebGPUProgram(g,[a,f],s.dtype,c);return i.disposeData(f.dataId),x}},sW={kernelName:Y.MaxPoolWithArgmax,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{filterSize:a,strides:s,pad:o,includeBatchInIndex:n}=r,{x:u}=t;y.util.assert(4===u.shape.length,()=>`Error in maxPool: input must be rank 4 but got rank ${u.shape.length}.`);let l=[1,1];y.util.assert(m.backend_util.eitherStridesOrDilationsAreOne(s,l),()=>`Error in maxPool: Either strides or dilations must be 1. Got strides ${s} and dilations '${l}'`);let d=m.backend_util.computePool2DInfo(u.shape,a,s,l,o),h=[{type:"int32",data:[d.strideHeight,d.strideWidth]},{type:"int32",data:[d.padInfo.top,d.padInfo.left]},{type:"int32",data:[d.dilationHeight,d.dilationWidth]},{type:"int32",data:[d.inHeight,d.inWidth]},{type:"int32",data:[d.effectiveFilterHeight,d.effectiveFilterWidth]}],p=new i0(d,"max",!1),c=i.runWebGPUProgram(p,[u],u.dtype,h);return p=new i0(d,"max",!0,!0,n),[c,i.runWebGPUProgram(p,[u],"int32",h)]}},sO={kernelName:Y.Min,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a}=t,{axis:s,keepDims:o}=r;return iB(a,s,o,"min",i)}},sU=e6({opType:l.MIN,cpuKernelImpl:ii}),sM={kernelName:Y.Minimum,backendName:"webgpu",kernelFunc:sU};class sV{constructor(e,t,i){this.uniforms="",this.variableNames=["x"],this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=t.map((t,i)=>t[0]+e[i]+t[1]),this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.xShape=e,t.map((e,t)=>{this.uniforms+=` pad${t} : vec2<i32>,`}),this.offset=+("reflect"!==i),this.shaderKey=`mirrorPad_${i}`}getUserCode(){let e=this.xShape.length,t=this.xShape.map((e,t)=>`uniforms.pad${t}[0]`).join(","),i=this.xShape.map((t,i)=>`uniforms.pad${i}[0] + uniforms.xShape${e>1?`[${i}]`:""}`).join(","),r=1===e?"start":"start[i]",a=1===e?"end":"end[i]",s=1===e?"outC":"outC[i]",o=R(e),n=e>1?["coords[0]","coords[1]","coords[2]","coords[3]"].slice(0,e):"coords";return`
      ${P("index")} {
        if (index < uniforms.size) {
          let start = ${o}(${t});
          let end = ${o}(${i});
          var outC = getCoordsFromIndex(index);
          for (var i = 0; i < ${e}; i = i + 1) {
            if (${s} < ${r}) {
              ${s} = ${r} * 2 - ${s} - ${this.offset};
            } else if(${s} >= ${a}) {
              ${s} = (${a} - 1) * 2 - ${s} + ${this.offset};
            }
          }
          let coords = outC - start;
          setOutputAtIndex(index, getX(${n}));
        }
      }
    `}}let sG={kernelName:Y.MirrorPad,backendName:"webgpu",kernelFunc:({inputs:e,attrs:t,backend:i})=>{let{x:r}=e,{paddings:a,mode:s}=t,o=a.map(e=>({type:"int32",data:[e[0],e[1]]})),n=new sV(r.shape,a,s);return i.runWebGPUProgram(n,[r],r.dtype,o)}},sH=e6({opType:l.MOD}),sX={kernelName:Y.Mod,backendName:"webgpu",kernelFunc:sH};class sK{constructor(e,t){this.variableNames=["probs"],this.outputShape=[],this.uniforms="seed : f32, numOutcomes: i32,",this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=[e,t],this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.shaderKey="multinomial"}getUserCode(){return`
    //Based on the work of Dave Hoskins
    //https://www.shadertoy.com/view/4djSRW
    fn random (seed : f32, resultUV : vec2<f32>) -> f32 {
      let HASHSCALE1 = 443.8975;
      let p = resultUV * seed;
      var p3  = fract(vec3<f32>(p.xyx) * HASHSCALE1);
      p3 = p3 + dot(p3, p3.yzx + 19.19);
      return fract((p3.x + p3.y) * p3.z);
    }

    ${P("index")} {
      if (index < uniforms.size) {
        let coords = getOutputCoords();
        let batch = coords[0];

        let resUV = vec2<f32>(f32(coords[1]) / f32(uniforms.outShape[1]),
            f32(coords[0]) / f32(uniforms.outShape[0]));
        let r = random(uniforms.seed, resUV);
        var cdf = 0.0;
        for (var i = 0; i < uniforms.numOutcomes - 1; i = i + 1) {
          cdf = cdf + getProbs(batch, i);

          if (r < cdf) {
            setOutputAtIndexI32(index, i);
            return;
          }
        }

        // If no other event happened, last event happened.
        setOutputAtIndexI32(index, uniforms.numOutcomes - 1);
      }
    }
  `}}class sq{constructor(e){this.variableNames=["logits"],this.outputShape=e,this.dispatchLayout=U(this.outputShape),this.dispatch=[this.outputShape[0],1,1],this.outputShape[1]>=4096?this.workgroupSize=[256,1,1]:this.workgroupSize=[64,1,1],this.shaderKey="softmax"}getUserCode(){return`
    var<workgroup> buf : array<f32, ${this.workgroupSize[0]}>;
    var<workgroup> rowMaxShared : f32;
    var<workgroup> rowSumShared : f32;
    const blockSize = ${this.workgroupSize[0]};
    ${P("index")} {
      let row = index / blockSize;
      let tid = i32(localId.x);
      let cols = uniforms.outShape[1];

      var threadMax = -3.402823e+38f;
      for (var col = tid; col < cols; col += blockSize) {
        let value = getLogits(row, col);
        threadMax = max(threadMax, value);
      }
      if (tid < cols) {
        buf[tid] = threadMax;
      }
      workgroupBarrier();

      var reduceSize = min(cols, blockSize);
      for (var currSize = reduceSize >> 1;  currSize > 0; currSize = reduceSize >> 1) {
        reduceSize = currSize + (reduceSize & 1);
        if (tid < currSize) {
          buf[tid] = max(buf[tid], buf[tid + reduceSize]);
        }
        workgroupBarrier();
      }

      if (tid == 0) {
        rowMaxShared = buf[0];
      }
      workgroupBarrier();

      var threadSum = 0.0;
      for (var col = tid; col < cols; col += blockSize) {
        let subExp = exp(getLogits(row, col) - rowMaxShared);
        threadSum += subExp;
      }
      buf[tid] = threadSum;
      workgroupBarrier();

      for (var currSize = blockSize >> 1;  currSize > 0; currSize = currSize >> 1) {
        if (tid < currSize) {
          buf[tid] = buf[tid] + buf[tid + currSize];
        }
        workgroupBarrier();
      }

      if (tid == 0) {
        rowSumShared = buf[0];
      }
      workgroupBarrier();

      for (var col = tid; col < cols; col += blockSize) {
        let value = exp(getLogits(row, col) - rowMaxShared) / rowSumShared;
        setOutputAtCoords(row, col, value);
      }
  }
    `}}function sY(e){let{inputs:t,backend:i,attrs:r}=e,{logits:a}=t,{dim:s}=r,o=eX({inputs:{x:a},backend:i,attrs:{shape:[y.util.sizeFromShape(a.shape)/a.shape[s],a.shape[s]]}}),n=new sq(o.shape),u=i.runWebGPUProgram(n,[o],a.dtype),l=eX({inputs:{x:u},backend:i,attrs:{shape:a.shape}});return i.disposeData(o.dataId),i.disposeData(u.dataId),l}let sj={kernelName:Y.Softmax,backendName:"webgpu",kernelFunc:sY},sQ={kernelName:Y.Multinomial,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{logits:a}=t,{numSamples:s,seed:o,normalized:n}=r,u=n?a:sY({inputs:{logits:a},backend:i,attrs:{dim:a.shape.length-1}}),l=u.shape[0],d=u.shape[1],h=new sK(l,s),p=i.runWebGPUProgram(h,[u],"int32",[{type:"float32",data:[o]},{type:"int32",data:[d]}]);return n||i.disposeData(u.dataId),p}},sZ={kernelName:Y.Neg,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i}=e,{x:r}=t;if(i.shouldExecuteOnCPU([r])){let[e,t]=ia(i.tensorMap.get(r.dataId).values,r.shape,r.dtype);return i.makeTensorInfo(t,r.dtype,e)}let a=new e3(r.shape,d.NEG);return i.runWebGPUProgram(a,[r],r.dtype)}};var sJ=e.i(277822),sJ=sJ;let s2={kernelName:Y.NonMaxSuppressionV3,backendName:"webgpu",kernelFunc:function(e){console.warn("tf.nonMaxSuppression() in webgpu locks the UI thread. Call tf.nonMaxSuppressionAsync() instead");let{inputs:t,backend:i,attrs:r}=e,{boxes:a,scores:s}=t,{maxOutputSize:o,iouThreshold:n,scoreThreshold:u}=r,l=i.readSync(a.dataId),d=i.readSync(s.dataId),{selectedIndices:h}=sJ.nonMaxSuppressionV3Impl(l,d,o,n,u);return i.makeTensorInfo([h.length],"int32",new Int32Array(h))}};var sJ=sJ;let s0={kernelName:Y.NonMaxSuppressionV5,backendName:"webgpu",kernelFunc:function(e){console.warn("tf.nonMaxSuppression() in webgpu locks the UI thread. Call tf.nonMaxSuppressionAsync() instead");let{inputs:t,backend:i,attrs:r}=e,{boxes:a,scores:s}=t,{maxOutputSize:o,iouThreshold:n,scoreThreshold:u,softNmsSigma:l}=r,d=i.readSync(a.dataId),h=i.readSync(s.dataId),{selectedIndices:p,selectedScores:c}=sJ.nonMaxSuppressionV5Impl(d,h,o,n,u,l);return[i.makeTensorInfo([p.length],"int32",new Int32Array(p)),i.makeTensorInfo([c.length],"float32",new Float32Array(c))]}};class s1{constructor(e,t){this.variableNames=["x"],this.uniforms="onValue : f32, offValue : f32,",this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=[e,t],this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.shaderKey="onehot"}getUserCode(){return`
      ${P("index")} {
        if(index < uniforms.size) {
          let coords = getCoordsFromIndex(index);
          setOutputAtIndex(index, mix(uniforms.offValue, uniforms.onValue,
                                      f32(i32(round(getX(coords.x))) == coords.y)));
        }
      }
    `}}let s3={kernelName:Y.OneHot,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{indices:a}=t,{dtype:s,depth:o,onValue:n,offValue:u}=r,l=y.util.sizeFromShape(a.shape),d=new s1(l,o),h=eX({inputs:{x:a},backend:i,attrs:{shape:[l]}}),p=i.runWebGPUProgram(d,[h],s,[{type:"float32",data:[n]},{type:"float32",data:[u]}]);i.disposeData(h.dataId);let c=eX({inputs:{x:p},backend:i,attrs:{shape:[...a.shape,o]}});return i.disposeData(p.dataId),c}};function s4(e){let{inputs:t,backend:i}=e,{x:r}=t;if("complex64"!==r.dtype)return eG({attrs:{shape:r.shape,dtype:r.dtype,value:"string"===r.dtype?"":0},backend:i});{let e=rb({inputs:{input:r},backend:i}),t=s4({inputs:{x:e},backend:i}),a=rD({inputs:{input:r},backend:i}),s=s4({inputs:{x:a},backend:i}),o=e0({inputs:{real:t,imag:s},backend:i});return i.disposeData(e.dataId),i.disposeData(t.dataId),i.disposeData(a.dataId),i.disposeData(s.dataId),o}}let s6={kernelName:Y.ZerosLike,backendName:"webgpu",kernelFunc:s4},s5={kernelName:Y.OnesLike,backendName:"webgpu",kernelFunc:function e(t){let{inputs:i,backend:r}=t,{x:a}=i;if("string"===a.dtype)throw Error("onesLike is not supported under string dtype");if("complex64"!==a.dtype)return eG({attrs:{shape:a.shape,dtype:a.dtype,value:1},backend:r});{let t=rb({inputs:{input:a},backend:r}),i=e({inputs:{x:t},backend:r}),s=rD({inputs:{input:a},backend:r}),o=s4({inputs:{x:s},backend:r}),n=e0({inputs:{real:i,imag:o},backend:r});return r.disposeData(t.dataId),r.disposeData(i.dataId),r.disposeData(s.dataId),r.disposeData(o.dataId),n}}},s8={kernelName:Y.Pack,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{axis:a}=r;if(1===t.length)return aE({inputs:{input:t[0]},backend:i,attrs:{dim:a}});let s=t[0].shape,o=t[0].dtype;t.forEach(e=>{y.util.assertShapesMatch(s,e.shape,"All tensors passed to stack must have matching shapes"),y.util.assert(o===e.dtype,()=>"All tensors passed to stack must have matching dtypes")});let n=[],u=rF({inputs:t.map(e=>{let t=aE({inputs:{input:e},backend:i,attrs:{dim:a}});return n.push(t),t}),backend:i,attrs:{axis:a}});return n.forEach(e=>i.disposeData(e.dataId)),u}};function s9(e,t=!1){let i=e.length,r=R(i),a=e.map((e,t)=>`uniforms.pad${t}[0]`).join(","),s=e.map((e,t)=>`uniforms.pad${t}[0] + uniforms.xShape${i>1?`[${t}]`:""}`).join(","),o=i>1?`${r}(${a})`:`${a}`,n=i>1?`${r}(${s})`:`${s}`,u=i>1?"any(paddedCoords < start)":"paddedCoords < start",l=i>1?"any(paddedCoords >= end)":"paddedCoords >= end",d=i>1?["coords[0]","coords[1]","coords[2]","coords[3]"].slice(0,i):"coords";return`
        let start = ${o};
        let end = ${n};
        if (${u} || ${l}) {
          setOutputAtIndex(index, ${t?0:"uniforms.constantValue"});
        } else {
          let coords = paddedCoords - start;
          setOutputAtIndex(index, getX(${d}));
        }
  `}class s7{constructor(e,t){this.variableNames=["x"],this.uniforms="constantValue : f32,",this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=t.map((t,i)=>t[0]+e[i]+t[1]),this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),t.map((e,t)=>{this.uniforms+=` pad${t} : vec2<i32>,`}),this.xShape=e,this.shaderKey="pad"}getUserCode(){return`
      ${P("index")} {
        if (index < uniforms.size) {
          let paddedCoords = getCoordsFromIndex(index);
          ${s9(this.xShape)}
        }
      }
    `}}let oe={kernelName:Y.PadV2,backendName:"webgpu",kernelFunc:e=>{let{inputs:t,backend:i,attrs:r}=e,{x:a}=t,{paddings:s,constantValue:o}=r;if(s.every(e=>y.util.arraysEqual(e,[0,0])))return eJ({inputs:{x:a},backend:i});if(0===y.util.sizeFromShape(a.shape))return eG({backend:i,attrs:{shape:s.map((e,t)=>e[0]+a.shape[t]+e[1]),value:o,dtype:a.dtype}});let n=[{type:"float32",data:[o]}];s.map(e=>n.push({type:"int32",data:[e[0],e[1]]}));let u=new s7(a.shape,s);return i.runWebGPUProgram(u,[a],a.dtype,n)}},ot=e6({opType:l.POW}),oi={kernelName:Y.Pow,backendName:"webgpu",kernelFunc:ot},or={kernelName:Y.Prelu,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i}=e,{x:r,alpha:a}=t,s=new eZ(l.PRELU,r.shape,a.shape);return i.runWebGPUProgram(s,[r,a],"float32")}},oa={kernelName:Y.Prod,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a}=t,{axis:s,keepDims:o}=r;return iB(a,s,o,"prod",i)}},os={kernelName:Y.Range,backendName:"webgpu",kernelFunc:e=>{let{backend:t,attrs:i}=e,{start:r,stop:a,step:s,dtype:o}=i,n=iu(r,a,s,o);return t.makeTensorInfo([n.length],o,n)}},oo=e6({opType:l.DIV}),on={kernelName:Y.RealDiv,backendName:"webgpu",kernelFunc:oo},ou=e4({opType:d.RECIPROCAL}),ol={kernelName:Y.Reciprocal,backendName:"webgpu",kernelFunc:ou},od=e4({opType:d.RELU}),oh={kernelName:Y.Relu,backendName:"webgpu",kernelFunc:od},op=e4({opType:d.RELU6}),oc={kernelName:Y.Relu6,backendName:"webgpu",kernelFunc:op};class of{constructor(e,t,i){this.variableNames=["x"],this.uniforms="adjustHeightWidth : vec2<f32>, halfPixelCenters : f32,",this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=[e[0],t,i,e[3]],this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.shaderKey="resizeBilinear"}getUserCode(){return`
      ${P("index")} {
        if (index < uniforms.size) {
        let coords = getCoordsFromIndex(index);
          let b = coords[0];
          let d = coords[3];
          let rc = coords.yz;

          let effectiveInSize = vec2<f32>(
            f32(uniforms.xShape.y) - uniforms.adjustHeightWidth[0],
            f32(uniforms.xShape.z) - uniforms.adjustHeightWidth[1]);

          let effectiveOutSize = vec2<f32>(
            f32(uniforms.outShape.y) - uniforms.adjustHeightWidth[0],
            f32(uniforms.outShape.z) - uniforms.adjustHeightWidth[1]);

          let effectiveInputOverOutputRatioRC =
              effectiveInSize / effectiveOutSize;

          // Fractional source index
          let sourceFracIndexRC =
            (vec2<f32>(rc) + vec2<f32>(uniforms.halfPixelCenters)) *
            effectiveInputOverOutputRatioRC - vec2<f32>(uniforms.halfPixelCenters);

          // Compute the four integer indices.
          let sourceFloorRC = vec2<i32>(sourceFracIndexRC);
          let sourceCeilRC = vec2<i32>(
            min(vec2<f32>(uniforms.xShape.yz) - vec2<f32>(1.0), ceil(sourceFracIndexRC)));

          let topLeft = getX(b, sourceFloorRC.x, sourceFloorRC.y, d);
          let bottomLeft = getX(b, sourceCeilRC.x, sourceFloorRC.y, d);
          let topRight = getX(b, sourceFloorRC.x, sourceCeilRC.y, d);
          let bottomRight = getX(b, sourceCeilRC.x, sourceCeilRC.y, d);

          let fracRC = sourceFracIndexRC - vec2<f32>(sourceFloorRC);

          let top = topLeft + (topRight - topLeft) * fracRC.y;
          let bottom = bottomLeft + (bottomRight - bottomLeft) * fracRC.y;
          let newValue = top + (bottom - top) * fracRC.x;

          setOutputAtIndex(index, newValue);
        }
      }
    `}}let om={kernelName:Y.ResizeBilinear,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{images:a}=t,{alignCorners:s,size:o,halfPixelCenters:n}=r,[u,l]=o,d=[{type:"float32",data:[s&&u>1?1:0,s&&l>1?1:0]},{type:"float32",data:[.5*!!n]}],h=new of(a.shape,u,l);return i.runWebGPUProgram(h,[a],"float32",d)}};class og{constructor(e,t){this.variableNames=["dy"],this.uniforms=`effectiveXSize : vec2<i32>, effectiveYSize : vec2<i32>, heightScale : f32, widthScale : f32,
       invHeightScale : f32, invWidthScale : f32, winHeight : i32, winWidth : i32,`,this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.alignCorners=t,this.shaderKey=`resizeBilinearBackprop_${t}`}getUserCode(){return`
      ${P("index")} {
        if (index < uniforms.size) {
          let coords = getOutputCoords();
          let b = coords[0];
          let d = coords[3];
          let r = coords[1];
          let c = coords[2];

          var accumulator = 0.0;

          // Compute bounds for where in dy we will look
          let startRLerp = floor(f32(r) * uniforms.invHeightScale);
          let startDyR = i32(startRLerp - f32(uniforms.winHeight / 2));

          let startCLerp = floor(f32(c) * uniforms.invWidthScale);
          let startDyC = i32(startCLerp - f32(uniforms.winWidth / 2));

          // Loop over dy
          for (var dyROffset = 0; dyROffset < uniforms.winHeight; dyROffset++) {
            let dyR = startDyR + dyROffset;

            // Guard against the window exceeding the bounds of dy
            if (dyR < 0 || dyR >= uniforms.dyShape[1]) {
              continue;
            }

            for (var dyCOffset = 0; dyCOffset < uniforms.winWidth; dyCOffset++) {
              let dyC = startDyC + dyCOffset;

              // Guard against the window exceeding the bounds of dy
              if (dyC < 0 || dyC >= uniforms.dyShape[2]) {
                continue;
              }

              let dxR = f32(dyR) * uniforms.heightScale;
              let topDxRIndex = i32(floor(dxR));
              let bottomDxRIndex = i32(min(ceil(dxR), f32(uniforms.outShape[1] - 1)));
              let dxRLerp = dxR - f32(topDxRIndex);
              let inverseDxRLerp = 1.0 - dxRLerp;

              let dxC = f32(dyC) * uniforms.widthScale;
              let leftDxCIndex = i32(floor(dxC));
              let rightDxCIndex = i32(min(ceil(dxC), f32(uniforms.outShape[2] - 1)));
              let dxCLerp = dxC - f32(leftDxCIndex);
              let inverseDxCLerp = 1.0 - dxCLerp;

              if (r == topDxRIndex && c == leftDxCIndex) {
                // topLeft
                accumulator +=
                  getDy(b, dyR, dyC, d) * inverseDxRLerp * inverseDxCLerp;
              }

              if (r == topDxRIndex && c == rightDxCIndex) {
                // topRight
                accumulator += getDy(b, dyR, dyC, d) * inverseDxRLerp * dxCLerp;
              }

              if (r == bottomDxRIndex && c == leftDxCIndex) {
                // bottomLeft
                accumulator += getDy(b, dyR, dyC, d) * dxRLerp * inverseDxCLerp;
              }

              if (r == bottomDxRIndex && c == rightDxCIndex) {
                // bottomRight
                accumulator += getDy(b, dyR, dyC, d) * dxRLerp * dxCLerp;
              }
            }
          }
          // End loop over dy

          setOutputAtIndex(index, accumulator);
        }
      }
    `}}let ox={kernelName:Y.ResizeBilinearGrad,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{images:a,dy:s}=t,{alignCorners:o}=r,[,n,u]=a.shape,[,l,d]=s.shape,h=[o&&l>1?n-1:n,o&&d>1?u-1:u],p=[o&&l>1?l-1:l,o&&d>1?d-1:d],c=h[0]/p[0],f=h[1]/p[1],m=1/c,g=1/f,x=2*Math.ceil(m)+2,y=2*Math.ceil(g)+2,w=new og(a.shape,o),b=[{type:"int32",data:h},{type:"int32",data:p},{type:"float32",data:[c]},{type:"float32",data:[f]},{type:"float32",data:[m]},{type:"float32",data:[g]},{type:"int32",data:[x]},{type:"int32",data:[y]}];return i.runWebGPUProgram(w,[s],s.dtype,b)}};class oy{constructor(e,t,i,r){this.variableNames=["x"],this.uniforms="adjustHeightWidth : vec2<f32>, roundBase : f32,",this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=[e[0],t,i,e[3]],this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.halfPixelCenters=r,this.shaderKey=`resizeNearest_${r}`}getUserCode(){let e;return e=this.halfPixelCenters?"max((vec2<f32>(rc) + vec2<f32>(0.5)) * effectiveInputOverOutputRatioRC, vec2<f32>(0.0))":"vec2<f32>(rc) * effectiveInputOverOutputRatioRC",`
      ${P("index")} {
        if (index < uniforms.size) {
          let coords = getCoordsFromIndex(index);
          let b = coords[0];
          let d = coords[3];
          let rc = coords.yz;

          let effectiveInSize = vec2<f32>(
            f32(uniforms.xShape.y) - uniforms.adjustHeightWidth[0],
            f32(uniforms.xShape.z) - uniforms.adjustHeightWidth[1]);

          let effectiveOutSize = vec2<f32>(
            f32(uniforms.outShape.y) - uniforms.adjustHeightWidth[0],
            f32(uniforms.outShape.z) - uniforms.adjustHeightWidth[1]);

          let effectiveInputOverOutputRatioRC =
              effectiveInSize / effectiveOutSize;

          // Fractional source index
          let sourceFracIndexRC = ${e};

          // Compute the coordinators of nearest neighbor point.
          let inputShapeRC = vec2<f32>(f32(uniforms.xShape.y), f32(uniforms.xShape.z));
          let sourceNearestRC = vec2<i32>(
            min(inputShapeRC - 1.0, floor(sourceFracIndexRC + uniforms.roundBase)));
          let newValue = getX(b, sourceNearestRC.x, sourceNearestRC.y, d);

          setOutputAtIndex(index, newValue);
        }
      }
    `}}let ow={kernelName:Y.ResizeNearestNeighbor,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{images:a}=t,{alignCorners:s,halfPixelCenters:o,size:n}=r,[u,l]=n,d=[{type:"float32",data:[s&&u>1?1:0,s&&l>1?1:0]},{type:"float32",data:[.5*!!s]}],h=new oy(a.shape,u,l,o);return i.runWebGPUProgram(h,[a],a.dtype,d)}};class ob{constructor(e,t){this.variableNames=["dy"],this.uniforms=`effectiveXSize : vec2<i32>, effectiveYSize : vec2<i32>, invHeightScale : f32, invWidthScale : f32,
       winHeight : i32, winWidth : i32,`,this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.alignCorners=t,this.shaderKey=`resizeNearestNeigborBackprop_${t}`}getUserCode(){return`
      ${P("index")} {
        if (index < uniforms.size) {
          let coords = getOutputCoords();
          let b = coords[0];
          let d = coords[3];
          let r = coords[1];
          let c = coords[2];

          var accumulator = 0.0;

          // Compute bounds for where in dy we will look
          let startRLerp = floor(f32(r) * uniforms.invHeightScale);
          let startDyR = i32(floor(startRLerp - f32(uniforms.winHeight / 2)));

          let startCLerp = floor(f32(c) * uniforms.invWidthScale);
          let startDyC = i32(floor(startCLerp - f32(uniforms.winWidth / 2)));

          // Loop over dy
          for (var dyROffset = 0; dyROffset < uniforms.winHeight; dyROffset++) {
            let dyR = startDyR + dyROffset;

            // Guard against the window exceeding the bounds of dy
            if (dyR < 0 || dyR >= uniforms.dyShape[1]) {
              continue;
            }

            for (var dyCOffset = 0; dyCOffset < uniforms.winWidth; dyCOffset++) {
              let dyC = startDyC + dyCOffset;

              // Guard against the window exceeding the bounds of dy
              if (dyC < 0 || dyC >= uniforms.dyShape[2]) {
                continue;
              }

              let sourceFracRow = f32(uniforms.effectiveXSize[0]) *
                  (f32(dyR) / f32(uniforms.effectiveYSize[0]));

              let sourceFracCol = f32(uniforms.effectiveXSize[1]) *
                  (f32(dyC) / f32(uniforms.effectiveYSize[1]));

              let sourceNearestRow =
                  i32(min(f32(uniforms.outShape[1] - 1),
                  ${this.alignCorners?"floor(sourceFracRow + 0.5)":"floor(sourceFracRow)"}));

              let sourceNearestCol =
                  i32(min(f32(uniforms.outShape[2] - 1),
                  ${this.alignCorners?"floor(sourceFracCol + 0.5)":"floor(sourceFracCol)"}));

              if (r == sourceNearestRow && c == sourceNearestCol) {
                accumulator += getDy(b, dyR, dyC, d);
              }
            }
          }
          // End loop over dy

          setOutputAtIndex(index, accumulator);
        }
      }
    `}}let oC={kernelName:Y.ResizeNearestNeighborGrad,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{images:a,dy:s}=t,{alignCorners:o}=r,[,n,u]=a.shape,[,l,d]=s.shape,h=[o&&l>1?n-1:n,o&&d>1?u-1:u],p=[o&&l>1?l-1:l,o&&d>1?d-1:d],c=h[0]/p[0],f=h[1]/p[1],m=1/c,g=1/f,x=2*Math.ceil(m)+2,y=2*Math.ceil(g)+2,w=new ob(a.shape,o),b=[{type:"int32",data:h},{type:"int32",data:p},{type:"float32",data:[m]},{type:"float32",data:[g]},{type:"int32",data:[x]},{type:"int32",data:[y]}];return i.runWebGPUProgram(w,[s],s.dtype,b)}};class oS{constructor(e){this.variableNames=["x"],this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.uniforms=" axis : vec4<i32>,",this.shaderKey="reverse"}getUserCode(){let e=`
      // Using uniform variables as judging conditions, so the function has
      // coherent execution within all threads.
      fn getReverseCoords(coords : vec4<i32>) -> vec4<i32> {
        var reverseCoords = coords;
        if (uniforms.axis[0] == 1) {
          reverseCoords[0] = uniforms.xShape[0] - coords[0] - 1;
        }
        if (uniforms.axis[1] == 1) {
          reverseCoords[1] = uniforms.xShape[1] - coords[1] - 1;
        }
        if (uniforms.axis[2] == 1) {
          reverseCoords[2] = uniforms.xShape[2] - coords[2] - 1;
        }
        if (uniforms.axis[3] == 1) {
          reverseCoords[3] = uniforms.xShape[3] - coords[3] - 1;
        }

        return reverseCoords;
      }
    `;return`
      ${e}
      ${P("index")} {
        if (index < uniforms.size) {
          let coords = getCoordsFromIndex(index);
          let reverseCoords = getReverseCoords(coords);
          setOutputAtIndex(index, getX(reverseCoords[0],
              reverseCoords[1], reverseCoords[2], reverseCoords[3]));
        }
      }
    `}}let ov={kernelName:Y.Reverse,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a}=t,{dims:s}=r,o=a.shape.length;if(0===o)return eJ({inputs:{x:a},backend:i});let n=a.shape,u=[1,1,1,1];n.forEach((e,t)=>{u[t+4-o]=e});let l=y.util.parseAxisParam(s,a.shape),d=[0,0,0,0];l.forEach(e=>{d[e+4-o]=1});let h=[{type:"int32",data:d}],p=eX({inputs:{x:a},backend:i,attrs:{shape:u}}),c=new oS(u),f=i.runWebGPUProgram(c,[p],p.dtype,h);i.disposeData(p.dataId);let m=eX({inputs:{x:f},backend:i,attrs:{shape:n}});return i.disposeData(f.dataId),m}};class oI{constructor(e,t){this.outputShape=[],this.variableNames=["x"],this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.uniforms=`centerX : f32, centerY : f32, sinRadians : f32,
          cosRadians : f32,`,this.shaderKey="rotate",this.outputShape=e,"number"==typeof t?(this.uniforms+=" fillValue : f32,",this.fillSnippet="var outputValue = uniforms.fillValue;",this.shaderKey+="_float"):(this.uniforms+=" fillValue : vec3<f32>,",this.fillSnippet="var outputValue = uniforms.fillValue[coords[3]];",this.shaderKey+="_vec3")}getUserCode(){return`
        ${P("index")} {
          if (index < uniforms.size) {
            let coords = getCoordsFromIndex(index);
            let coordXFloat = (f32(coords[2]) - uniforms.centerX) *
                uniforms.cosRadians - (f32(coords[1]) - uniforms.centerY) *
                uniforms.sinRadians;
            let coordYFloat = (f32(coords[2]) - uniforms.centerX) *
                uniforms.sinRadians + (f32(coords[1]) - uniforms.centerY) *
                uniforms.cosRadians;
            let coordX = i32(round(coordXFloat + uniforms.centerX));
            let coordY = i32(round(coordYFloat + uniforms.centerY));
            ${this.fillSnippet}
            if(coordX >= 0 && coordX < uniforms.xShape[2] && coordY >= 0 &&
                coordY < uniforms.xShape[1]) {
              outputValue = getX(coords[0], coordY, coordX, coords[3]);
            }
            setOutputAtIndex(index, outputValue);
          }
        }
      `}}let ok={kernelName:Y.RotateWithOffset,backendName:"webgpu",kernelFunc:({inputs:e,attrs:t,backend:i})=>{let{image:r}=e,{radians:a,fillValue:s,center:o}=t,n=new oI(r.shape,s),[u,l]=m.backend_util.getImageCenter(o,r.shape[1],r.shape[2]),d=[{type:"float32",data:[u]},{type:"float32",data:[l]},{type:"float32",data:[Math.sin(a)]},{type:"float32",data:[Math.cos(a)]}];return"number"==typeof s?d.push({type:"float32",data:[Number.parseFloat(s.toFixed(2))]}):d.push({type:"float32",data:s}),i.runWebGPUProgram(n,[r],r.dtype,d)}},oR=e4({opType:d.ROUND}),o$={kernelName:Y.Round,backendName:"webgpu",kernelFunc:oR},oP=e4({opType:d.RSQRT,cpuKernelImpl:il}),oz={kernelName:Y.Rsqrt,backendName:"webgpu",kernelFunc:oP};class oA{constructor(e,t,i,r,a,s,o,n=!0){this.variableNames=["updates","indices"],this.workgroupSize=[64,1,1],this.atomic=!0,this.outputShape=s,this.type=o,this.sumDupeIndices=n,this.dispatchLayout=U(e),this.dispatch=L(this.dispatchLayout,e,this.workgroupSize),this.sliceDimGreaterThanOne=t>1,this.shaderKey=`scatter_${i}_${r}_${this.sliceDimGreaterThanOne}_${o}_${n}_${a.length}`;const u=R(a.length);this.uniforms=`sliceDim : i32, strides: ${u}, updatesSize: i32,`,this.updatesRank=r,this.indicesRank=i}getUserCode(){let e="";1===this.indicesRank?e="coords[0]":2===this.indicesRank&&(e="coords[0], j");let t=`getIndices(${e})`,i=this.sliceDimGreaterThanOne?"uniforms.strides[j]":"uniforms.strides",r="",a="";1===this.dispatchLayout.x.length?(r="flattenedIndex",a=`
      fn getUpdatesCoordsFromFlatIndex(index : i32) -> i32 {
        return index;
      }
      `):2===this.dispatchLayout.x.length&&(r="vec2<i32>(flattenedIndex, coords[1])",a=`
      fn getUpdatesCoordsFromFlatIndex(index : i32) -> vec2<i32> {
        // N.B. |updates| could be a scalar tensor, conceptually representing a
        // 2D tensor with all values equal to that. By design, its size must be
        // the same as |outShape[1]| in one dimension, and |indicesShape[0]|
        // gives the other.
        let sliceSize = uniforms.outShape[1];
        let d0 = index / sliceSize;
        let d1 = index - d0 * sliceSize;
        return vec2<i32>(d0, d1);
      }
      `);let s=Array.from({length:this.updatesRank},(e,t)=>`coords[${t}]`),o=`getUpdates(${s.join(", ")})`;return`
    ${a}
      ${P("index")} {
        if (index < uniforms.updatesSize) {
          let coords = getUpdatesCoordsFromFlatIndex(index);
          var flattenedIndex = 0;
          for (var j = 0; j < uniforms.sliceDim; j = j + 1) {
            let indexInside = i32(round(${t}));
            flattenedIndex = flattenedIndex + indexInside * ${i};
          }
          let updateValue =
              ${F(this.type)}(${o});
          let flatIndex = getOutputIndexFromCoords(${r});

          ${this.sumDupeIndices?I("&result[flatIndex]","updateValue",this.type):"atomicStore(&result[flatIndex], bitcast<i32>(updateValue));"}
        }
      }`}}let oN={kernelName:Y.ScatterNd,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{indices:a,updates:s}=t,{shape:o}=r,{sliceRank:n,numUpdates:u,sliceSize:l,strides:d,outputSize:h}=m.backend_util.calculateShapes(s,a,o),p=[h/l,l];if(0===h)return i.makeTensorInfo(o,a.dtype);let c=eX({inputs:{x:a},backend:i,attrs:{shape:[u,n]}}),f=eX({inputs:{x:s},backend:i,attrs:{shape:[u,l]}}),g=f.dtype,x=eG({backend:i,attrs:{shape:p,value:0,dtype:g}}),w=[{type:"int32",data:[n]},{type:"int32",data:d},{type:"int32",data:[y.util.sizeFromShape(f.shape)]}],b=new oA(f.shape,n,c.shape.length,f.shape.length,d,p,g),C=i.runWebGPUProgram(b,[f,c],g,w,x),S=eX({inputs:{x:C},backend:i,attrs:{shape:o}});return i.disposeData(c.dataId),i.disposeData(f.dataId),i.disposeData(C.dataId),S}};class oD{constructor(e,t){this.outputShape=[],this.variableNames=["sortedSequence","values"],this.uniforms="numInputs : i32,",this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.side=t,this.shaderKey=`search_sorted_${t}`}getUserCode(){let e="left"===this.side?"<":"<=";return`
      fn findBound(batch: i32, value: f32) -> i32 {
        var left = i32(0);
        var right = uniforms.numInputs;
        while (left < right) {
          var mid = (left + right) / 2;
          if (getSortedSequence(batch, mid) ${e} value) {
            left = mid + 1;
          } else {
            right = mid;
          }
        }
        return right;
      }

      ${P("index")} {
        if (index < uniforms.size) {
          let coords = getCoordsFromIndex(index);
          let value = getValuesByOutputIndex(index);
          setOutputAtIndexI32(index, findBound(coords[0], value));
        }
      }
    `}}let oT={kernelName:Y.SearchSorted,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{sortedSequence:a,values:s}=t,{side:o}=r,n=new oD([s.shape[0],s.shape[1]],o),u=[{type:"int32",data:[a.shape[1]]}];return i.runWebGPUProgram(n,[a,s],"int32",u)}};class oF{constructor(e,t,i){this.variableNames=["c","a","b"],this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=t,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.cRank=e,this.rank=i,this.shaderKey="select"}getUserCode(){let e,t;if(this.rank>4)throw Error(`Where for rank ${this.rank} is not yet supported`);if(1===this.rank)t="resRC",e="resRC";else{let i=["resRC.x","resRC.y","resRC.z","resRC.w"],r=[],a=[];for(let e=0;e<this.outputShape.length;e++)a.push(`${i[e]}`),e<this.cRank&&r.push(`${i[e]}`);e=r.join(),t=a.join()}return`
      ${P("index")} {
        if (index < uniforms.size) {
          let resRC = getCoordsFromIndex(index);
          let cVal = getC(${e});
          if (cVal >= 1.0) {
            setOutputAtIndex(index, getA(${t}));
          } else {
            setOutputAtIndex(index, getB(${t}));
          }
        }
      }
    `}}let o_={kernelName:Y.Select,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i}=e,{condition:r,t:a,e:s}=t,o=new oF(r.shape.length,a.shape,a.shape.length);return i.runWebGPUProgram(o,[r,a,s],(0,ej.upcastType)(a.dtype,s.dtype))}},oE=e4({opType:d.SELU}),oL={kernelName:Y.Selu,backendName:"webgpu",kernelFunc:oE},oB=e4({opType:d.SIGMOID}),oW={kernelName:Y.Sigmoid,backendName:"webgpu",kernelFunc:oB},oO=e4({opType:d.SIGN}),oU={kernelName:Y.Sign,backendName:"webgpu",kernelFunc:oO},oM=e4({opType:d.SIN}),oV={kernelName:Y.Sin,backendName:"webgpu",kernelFunc:oM},oG=e4({opType:d.SINH}),oH={kernelName:Y.Sinh,backendName:"webgpu",kernelFunc:oG},oX=e4({opType:d.SOFTPLUS}),oK={kernelName:Y.Softplus,backendName:"webgpu",kernelFunc:oX};class oq{constructor(e,t,i,r,a,s){this.variableNames=["x"],this.outputShape=[],this.uniforms="",this.workgroupSize=[64,1,1],this.size=!0;const o=Array(r.length);for(let e=0;e<o.length;e++)o[e]=r[a[e]];this.outputShape=o,this.newDim=a,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.xShape=e,this.paddedXShape=t,this.uniforms+=`reshapedPaddedXShape : ${R(r.length)}, paddedXShapeStrides : ${R(s)}, `,i.map((e,t)=>{this.uniforms+=` pad${t} : vec2<i32>,`}),this.shaderKey=`spaceToBatchND_${a}`}getUserCode(){let e=R(this.outputShape.length),t=iT(this.newDim);return`
      ${D(this.paddedXShape,"PaddedX")}
      ${P("index")} {
        if(index < uniforms.size) {
          let coords = getCoordsFromIndex(index);
          let switchedIndex = getIndexFromCoords${this.outputShape.length}D(${e}(${t}), uniforms.reshapedPaddedXShape);
          let paddedCoords = getPaddedXCoordsFromIndex(switchedIndex);
          ${s9(this.xShape,!0)}
        }
      }
    `}}let oY={kernelName:Y.SpaceToBatchND,backendName:"webgpu",kernelFunc:e=>{let{inputs:t,backend:i,attrs:r}=e,{x:a}=t,{blockShape:s,paddings:o}=r;y.util.assert(a.shape.length<=4,()=>"spaceToBatchND for rank > 4 with a WebGPU backend not implemented yet");let n=s.reduce((e,t)=>e*t),u=[[0,0]];u.push(...o);for(let e=1+s.length;e<a.shape.length;++e)u.push([0,0]);let l=u.map((e,t)=>e[0]+a.shape[t]+e[1]),d=m.backend_util.getReshaped(l,s,n,!1),h=m.backend_util.getPermuted(d.length,s.length,!1),p=m.backend_util.getReshapedPermuted(l,s,n,!1),c=y.util.computeStrides(l),f=new oq(a.shape,l,u,d,h,c.length),g=[{type:"int32",data:d},{type:"int32",data:c}];u.map(e=>g.push({type:"int32",data:[e[0],e[1]]}));let x=i.runWebGPUProgram(f,[a],a.dtype,g),w=eX({inputs:{x:x},backend:i,attrs:{shape:p}});return i.disposeData(x.dataId),w}};class oj{constructor(e,t,i){this.variableNames=["input","indices","segmentIds"],this.outputShape=[],this.uniforms="segmentSize : i32, sparseSize : i32,",this.workgroupSize=[64,1,1],this.atomic=!0,this.outputShape=e,this.type=i,this.dispatchLayout=U([t]),this.dispatch=L(this.dispatchLayout,[t],this.workgroupSize),this.shaderKey="sparseSegmentSum"}getUserCode(){return`
    ${P("index")} {
      if (index < uniforms.sparseSize) {
        let indexInSegmentIds = index / uniforms.segmentSize;
        let indexInSegment = index % uniforms.segmentSize;
        let indexInInput = indices[indexInSegmentIds];
        let segmentId = segmentIds[indexInSegmentIds];

        let value = input[indexInInput * uniforms.segmentSize + indexInSegment];
        let outIndex = segmentId * uniforms.segmentSize + indexInSegment;
        ${I("&result[outIndex]","value",this.type)}
      }
    }
  `}}class oQ{constructor(e,t){this.variableNames=["segmentIds"],this.outputShape=[],this.workgroupSize=[64,1,1],this.atomic=!0,this.outputShape=[e],this.dispatchLayout=U(t),this.dispatch=L(this.dispatchLayout,t,this.workgroupSize),this.shaderKey="sparseSegmentIdCountProgram"}getUserCode(){return`
    ${P("index")} {
      if (index < uniforms.segmentIdsShape) {
        let segmentId = segmentIds[index];
        ${I("&result[segmentId]","1","int32")}
      }
    }
  `}}class oZ{constructor(e,t){this.variableNames=["segmentSum","sameSegmentIdCount"],this.outputShape=[],this.uniforms="segmentSize : i32",this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e,this.type=t,this.dispatchLayout=U(e),this.dispatch=L(this.dispatchLayout,e,this.workgroupSize),this.shaderKey="sparseSegmentMean"}getUserCode(){return`
    ${P("index")} {
      if (index < uniforms.size) {
        let segmentId = index / uniforms.segmentSize;
        let count = sameSegmentIdCount[segmentId];
        if (count != 0) {
          ${"float32"===this.type?"setOutputAtIndex(index, segmentSum[index] / f32(count));":"setOutputAtIndexI32(index, segmentSum[index] / count);"}
        }
      }
    }
  `}}function oJ(e,t,i,r=!1,a){let s,o=y.util.sizeFromShape(e.shape)/e.shape[0],n=e.dtype,u=y.util.sizeFromShape(t.shape),l=a.readSync(i.dataId),d=u>0?l[u-1]+1:0,h=e.shape.slice();h[0]=d;let p=u*o,c=eG({backend:a,attrs:{shape:h,value:0,dtype:n}});s=new oj(h,p,n);let f=[{type:"int32",data:[o]},{type:"int32",data:[p]}],m=a.runWebGPUProgram(s,[e,t,i],n,f,c);if(r)return m;let g=eG({backend:a,attrs:{shape:[d],value:0,dtype:"int32"}});s=new oQ(d,i.shape);let x=a.runWebGPUProgram(s,[i],"int32",null,g),w=eG({backend:a,attrs:{shape:h,value:0,dtype:n}});s=new oZ(h,n),f=[{type:"int32",data:[o]}];let b=a.runWebGPUProgram(s,[m,x],n,f,w);return a.disposeData(m.dataId),a.disposeData(x.dataId),b}let o2={kernelName:Y.SparseSegmentMean,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i}=e,{data:r,indices:a,segmentIds:s}=t;return oJ(r,a,s,!1,i)}},o0={kernelName:Y.SparseSegmentSum,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i}=e,{data:r,indices:a,segmentIds:s}=t;return oJ(r,a,s,!0,i)}};class o1{constructor(e,t){this.variableNames=["A"],this.workgroupSize=[64,1,1],this.size=!0;const i=Array(e.length);for(let r=0;r<i.length;r++)i[r]=e[r]*t[r];this.outputShape=i,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.rank=this.outputShape.length,this.shaderKey="tile"}getUserCode(){let e=function(e,t=""){if(e>=5)throw Error(`Tile for rank ${e} is not yet supported`);if(1===e)return`(resRC % ${t}aShape)`;let i=["resRC.x","resRC.y","resRC.z","resRC.w"],r=[];for(let a=0;a<e;a++)r.push(`(${i[a]} % ${t}aShape[${a}])`);return r.join()}(this.rank,"uniforms.");return`
      ${P("index")} {
        if (index < uniforms.size) {
          let resRC = getCoordsFromIndex(index);
          setOutputAtIndex(index, getA(${e}));
        }
      }
    `}}function o3(e){let{inputs:t,backend:i,attrs:r}=e,{x:a}=t,{reps:s}=r;if(i.shouldExecuteOnCPU([a])||"string"===a.dtype||a.shape.length>=5){let e=i.readSync(a.dataId),t="string"===a.dtype?e.map(e=>y.util.decodeString(e)):e,r=ix((0,g.buffer)(a.shape,a.dtype,t),s);return i.makeTensorInfo(r.shape,r.dtype,r.values)}let o=new o1(a.shape,s);return i.runWebGPUProgram(o,[a],a.dtype)}let o4={kernelName:Y.Tile,backendName:"webgpu",kernelFunc:o3},o6={kernelName:Y.SparseToDense,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{sparseIndices:a,sparseValues:s,defaultValue:o}=t,{outputShape:n}=r,{sliceRank:u,numUpdates:l,sliceSize:d,strides:h,outputSize:p}=m.backend_util.calculateShapes(s,a,n);if("string"===s.dtype){let e=id(i.bufferSync(a),i.bufferSync(s),n,p,d,l,u,h,y.util.decodeString(i.readSync(o.dataId)[0]),!1);return i.makeTensorInfo(n,e.dtype,e.values)}let c=[p/d,d],f=eX({inputs:{x:a},backend:i,attrs:{shape:[l,u]}}),g=s.shape.length?eX({inputs:{x:s},backend:i,attrs:{shape:[l,d]}}):eJ({inputs:{x:s},backend:i}),x=g.dtype,w=i.makeTensorInfo([],x,y.util.makeZerosTypedArray(1,x)),b=eX({inputs:{x:o},backend:i,attrs:{shape:Array(c.length).fill(1)}}),C=o3({inputs:{x:b},backend:i,attrs:{reps:c}}),S=[{type:"int32",data:[u]},{type:"int32",data:h},{type:"int32",data:[y.util.sizeFromShape([l,d])]}];switch(l){case 0:break;case 1:{let e=new oA([l,d],u,f.shape.length,g.shape.length,h,c,x,!1);i.runWebGPUProgram(e,[g,f],x,S,C)}break;default:{let e=new oA([l,d],u,f.shape.length,w.shape.length,h,c,x,!1);i.runWebGPUProgram(e,[w,f],x,S,C)}{let e=new oA([l,d],u,f.shape.length,g.shape.length,h,c,x);i.runWebGPUProgram(e,[g,f],x,S,C)}}let v=eX({inputs:{x:C},backend:i,attrs:{shape:n}});return i.disposeData(f.dataId),i.disposeData(g.dataId),i.disposeData(b.dataId),i.disposeData(w.dataId),i.disposeData(C.dataId),v}},o5={kernelName:Y.SplitV,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a}=t,{numOrSizeSplits:s,axis:o}=r,n=y.util.parseAxisParam(o,a.shape)[0],u=m.backend_util.prepareSplitSize(a,s,n),l=Array(a.shape.length).fill(0),d=a.shape.slice();return u.map(e=>{let t=[...d];t[n]=e;let r=ru({inputs:{x:a},backend:i,attrs:{begin:l,size:t}});return l[n]+=e,r})}},o8=e4({opType:d.SQRT}),o9={kernelName:Y.Sqrt,backendName:"webgpu",kernelFunc:o8},o7={kernelName:Y.Square,backendName:"webgpu",kernelFunc:({inputs:e,backend:t})=>{let{x:i}=e,r=new e3(i.shape,d.SQUARE);return t.runWebGPUProgram(r,[i],i.dtype)}},ne=e6({opType:l.SQUARED_DIFFERENCE}),nt={kernelName:Y.SquaredDifference,backendName:"webgpu",kernelFunc:ne},ni={kernelName:Y.Step,backendName:"webgpu",kernelFunc:function({inputs:e,attrs:t,backend:i}){let{x:r}=e,a=new e3(r.shape,d.STEP,"stepAlpha : f32,"),s=[{type:"float32",data:[t.alpha]}];return i.runWebGPUProgram(a,[r],r.dtype,s)}};class nr{constructor(e){this.variableNames=["x"],this.workPerThread=1,this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize,[this.workPerThread,1,1]);const t=R(this.outputShape.length);this.uniforms=`begin : ${t},  strides : ${t}, `,this.shaderKey="stridedSlice"}getUserCode(){let e=this.outputShape.length,t="";if(1===e)t="coords * uniforms.strides + uniforms.begin";else{let e=0;t=this.outputShape.map((t,i)=>(e++,1===this.outputShape.length?`coords * uniforms.strides[${i}] + uniforms.begin[${i}]`:`coords[${e-1}] * uniforms.strides[${i}] + uniforms.begin[${i}]`)).join(",")}return`
       ${P("index")} {
         if (index < uniforms.size) {
           let coords = getCoordsFromIndex(index);
           setOutputAtIndex(index, getX(${t}));
         }
       }
     `}}let na={kernelName:Y.StridedSlice,backendName:"webgpu",kernelFunc:function(e){let t,{inputs:i,backend:r,attrs:a}=e,{x:s}=i,{begin:o,end:n,strides:u,beginMask:l,endMask:d,ellipsisMask:h,newAxisMask:p,shrinkAxisMask:c}=a,{finalShapeSparse:f,finalShape:m,isIdentity:x,sliceDim0:w,isSimpleSlice:b,begin:C,end:S,strides:v}=rs.slice_util.sliceInfo(s.shape,o,n,u,l,d,h,p,c);if(x)t=eX({inputs:{x:s},backend:r,attrs:{shape:m}});else if(w||b){y.util.assert(s.shape.length>=1,()=>`Input must have rank at least 1, got: ${s.shape.length}`);let e=rs.slice_util.computeOutShape(C,S,v),i=ru({inputs:{x:s},backend:r,attrs:{begin:C,size:e}});t=eX({inputs:{x:i},backend:r,attrs:{shape:m}}),r.disposeData(i.dataId)}else if(r.shouldExecuteOnCPU([s])){let e=r.readSync(s.dataId),i=ic(f,(0,g.buffer)(s.shape,s.dtype,e),v,C);t=r.makeTensorInfo(m,s.dtype,i.values)}else{let e=new nr(f),i=[{type:"int32",data:C},{type:"int32",data:v}],a=r.runWebGPUProgram(e,[s],s.dtype,i);t=eX({inputs:{x:a},backend:r,attrs:{shape:m}}),r.disposeData(a.dataId)}return t}},ns={kernelName:Y.StringNGrams,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{separator:a,nGramWidths:s,leftPad:o,rightPad:n,padWidth:u,preserveShortSequences:l}=r,{data:d,dataSplits:h}=t,[p,c]=im(i.readSync(d.dataId),i.readSync(h.dataId),a,s,o,n,u,l);return[i.makeTensorInfo([p.length],"string",p),i.makeTensorInfo(h.shape,"int32",c)]}},no=e6({opType:l.SUB,cpuKernelImpl:ig,supportsComplex:!0}),nn={kernelName:Y.Sub,backendName:"webgpu",kernelFunc:no},nu=e4({opType:d.TAN}),nl={kernelName:Y.Tan,backendName:"webgpu",kernelFunc:nu},nd=e4({opType:d.TANH}),nh={kernelName:Y.Tanh,backendName:"webgpu",kernelFunc:nd},np={kernelName:Y.TensorScatterUpdate,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{tensor:a,indices:s,updates:o}=t,{}=r,{sliceRank:n,numUpdates:u,sliceSize:l,strides:d,outputSize:h}=m.backend_util.calculateShapes(o,s,a.shape),p=[h/l,l];if(0===h)return i.makeTensorInfo(a.shape,s.dtype);let c=[],f=eX({inputs:{x:s},backend:i,attrs:{shape:[u,n]}});c.push(f);let g=eX({inputs:{x:o},backend:i,attrs:{shape:[u,l]}});c.push(g);let x=eX({inputs:{x:a},backend:i,attrs:{shape:p}});c.push(x);let w=o3({inputs:{x:x},backend:i,attrs:{reps:Array(p.length).fill(1)}}),b=new oA([u,l],n,f.shape.length,g.shape.length,d,p,a.dtype,!1),C=[{type:"int32",data:[n]},{type:"int32",data:d},{type:"int32",data:[y.util.sizeFromShape([u,l])]}],S=i.runWebGPUProgram(b,[g,f],x.dtype,C,w);c.push(S);let v=eX({inputs:{x:S},backend:i,attrs:{shape:a.shape}});return c.forEach(e=>i.disposeData(e.dataId)),v}};class nc{constructor(e){this.variableNames=["x","indices"],this.workgroupSize=[256,1,1],this.size=!0,this.outputShape=e,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.uniforms=`inputSize : i32, firstPass : i32, negativeInf : f32,
        dir : i32, inc : i32,`,this.shaderKey="swap"}getUserCode(){return`
        ${P("index")} {
          if (index < uniforms.size) {
            let outC = getCoordsFromIndex(index);
            let batch = outC[0];
            let elemIdx = outC[1];
            // We compare elements pair-wise within a group of size 2 * inc.
            // The comparing rule for each group alternates between ascending
            // and descending. Within each group, we compare each pair at
            // positions i and i+inc. To decide whether an element at position i
            // is x0 or x1, we mod it by 2 * inc, if the result is smaller than
            // inc, it is in the first half of the group, we denote it as x0,
            // otherwise we denote it as x1.
            // For example, as shown in the Bitonic top K paper referenced
            // above, Figure5(a) shows that element[1] is in the second half of
            // the group when group size is 2, but it is in the first half of
            // the group when group size is 4.
            let isFirstInPair = elemIdx % (2 * uniforms.inc) < uniforms.inc;
            var i = 0;
            if (isFirstInPair) {
              i = elemIdx;
            } else {
              i = elemIdx - uniforms.inc;
            }

            var i0 = 0;
            if (uniforms.firstPass == 1) {
              i0 = i;
            } else {
              i0 = i32(getIndices(batch, i));
            }

            var i1 = 0;
            if (uniforms.firstPass == 1) {
              i1 = i + uniforms.inc;
            } else {
              i1 = i32(getIndices(batch, i + uniforms.inc));
            }

            var x0 = f32(0.0);
            var x1 = f32(0.0);
            if (i0 < uniforms.inputSize) {
              x0 = getX(batch, i0);
            } else {
              x0 = uniforms.negativeInf;
            }
            if (i1 < uniforms.inputSize) {
              x1 = getX(batch, i1);
            } else {
              x1 = uniforms.negativeInf;
            }

            let reverse = elemIdx % (2 * uniforms.dir) >= uniforms.dir;
            let isGreater = x0 > x1 || (x0 == x1 && i1 > i0);
            if (reverse == isGreater) {
              // Elements in opposite order of direction
              let iTemp = i0;
              i0 = i1;
              i1 = iTemp;
            }
            if (isFirstInPair) {
              setOutputAtIndex(index, f32(i0));
            } else {
              setOutputAtIndex(index, f32(i1));
            }
          }
        }
      `}}class nf{constructor(e){this.variableNames=["x","indices"],this.workgroupSize=[256,1,1],this.size=!0,this.outputShape=e,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.uniforms="inputSize : i32, firstPass : i32, k : i32,",this.shaderKey="merge"}getUserCode(){return`
        ${P("index")} {
          if (index < uniforms.size) {
            let outC = getCoordsFromIndex(index);
            let batch = outC[0];
            let elemIdx = outC[1];
            // The output size is half of the previous size.
            // If the previous sequence is | | | | _ _ _ _  | | | |  _ _ _ _
            // (k=4), we only need to output the indices at positions |, the
            // indices at positions _ can be thrown away, see Figure5(b) After
            // Phase 2 (Merge phase) in the Bitonic Top K paper referenced
            // above.
            // For example, the paper shows we only need to output the orange
            // bars. The output sequence should look like this | | | | | | | |.
            // Because the sequence is halved, to map the output index back to
            // the previous sequence to find the corresponding value, we need
            // to double the index. When we double the index, we basically
            // interpolate a position, so 2i looks like
            // | _ | _ | _ | _ | _ | _ | _. We move the | to the first k
            // position of each 2k positions by - elemIdx % k. E.g. for output
            // at index 4,5,6,7, we want to get the corresponding element at
            // original index 8,9,10,11, for output at index 8,9,10,11,
            // we want to get the corresponding element at original index
            // 16,17,18,19, so on and so forth.

            var i = 0;
            if (elemIdx < uniforms.k) {
              i = elemIdx;
            } else {
              i = elemIdx * 2 - elemIdx % uniforms.k;
            }
            var i0 = 0;
            if (uniforms.firstPass == 1) {
              i0 = i;
            } else {
              i0 = i32(getIndices(batch, i));
            }
            var i1 = 0;
            if (uniforms.firstPass == 1) {
              i1 = i + uniforms.k;
            } else {
              i1 = i32(getIndices(batch, i + uniforms.k));
            }

            let x0 = getX(batch, i0);
            var x1 = f32(0.0);
            if (i1 < uniforms.inputSize) {
              x1 = getX(batch, i1);
            } else {
              x1 = x0;
            }

            if (x0 >= x1) {
              setOutputAtIndex(index, f32(i0));
            } else {
              setOutputAtIndex(index, f32(i1));
            }
          }
        }
      `}}function nm(e,t){null!==t&&e.disposeData(t.dataId)}function ng(e){let t=1;for(;t<e;)t*=2;return t}let nx={kernelName:Y.TopK,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a}=t,{k:s,sorted:o}=r,n=a.shape,u=n[n.length-1];if(i.shouldExecuteOnCPU([a])){let[e,t]=iy(i.readSync(a.dataId),n,a.dtype,s,o);return[i.makeTensorInfo(e.shape,e.dtype,e.values),i.makeTensorInfo(t.shape,t.dtype,t.values)]}if(0===s)return n[n.length-1]=0,[i.makeTensorInfo(n,a.dtype,[]),i.makeTensorInfo(n,"int32",[])];if(1===u)return[a,eG({attrs:{shape:n,dtype:"int32",value:0},backend:i})];let l=y.util.sizeFromShape(n)/u,d=eX({inputs:{x:a},attrs:{shape:[l,u]},backend:i}),h=ng(s),p=ng(u),c=null,f=()=>null===c?[d,d]:[d,c],m=(e,t,r)=>{let a=f(),s=new nc(r),o=[{type:"int32",data:[u]},{type:"int32",data:[+(null===c)]},{type:"float32",data:[-1/0]},{type:"int32",data:[e]},{type:"int32",data:[t]}],n=c;c=i.runWebGPUProgram(s,a,"int32",o),nm(i,n)};for(let e=1;e<h;e*=2){let t=2*e;for(let i=e;i>=1;i/=2)m(t,i,[l,p])}for(let e=p;e>h;e/=2){let t=f(),r=new nf([l,e/2]),a=[{type:"int32",data:[u]},{type:"int32",data:[+(null===c)]},{type:"int32",data:[h]}],s=c;c=i.runWebGPUProgram(r,t,"int32",a),nm(i,s);let o=h/2,n=2*o;for(let e=o;e>=1;e/=2)m(n,e,c.shape)}let g=c;c=ru({inputs:{x:c},backend:i,attrs:{begin:0,size:[l,s]}}),nm(i,g);let x=a6({inputs:{x:d,indices:c},backend:i,attrs:{axis:1,batchDims:1}});nm(i,d);let w=n.slice(0,-1);w.push(s),g=c,c=eX({inputs:{x:c},attrs:{shape:w},backend:i}),nm(i,g);let b=x;return x=eX({inputs:{x:x},attrs:{shape:w},backend:i}),nm(i,b),[x,c]}};class ny{constructor(e){this.variableNames=["Image","Transforms"],this.uniforms="interpolationModeId : i32, fillModeId : i32, fillValue : f32,",this.workgroupSize=[64,1,1],this.size=!0,this.outputShape=e,this.dispatchLayout=U(this.outputShape),this.dispatch=L(this.dispatchLayout,this.outputShape,this.workgroupSize),this.shaderKey="transform"}getUserCode(){return`
          fn mapCoord(outCoord : f32, len : f32) -> f32{
            var inCoord = outCoord;
            if(uniforms.fillModeId == 2) {
              if (inCoord < 0.0) {
                if (len <= 1.0) {
                  inCoord = 0.0;
                } else {
                  let sz2 = 2.0 * len;
                  if (inCoord < sz2) {
                    inCoord = sz2 * f32(i32(f32(-inCoord / sz2))) +
                    inCoord;
                  }
                  if (inCoord < -len) {
                    inCoord = inCoord + sz2;
                  } else {
                    inCoord = -inCoord - 1.0;
                  }
                }
              } else if (inCoord > len - 1.0) {
                if (len <= 1.0) {
                  inCoord = 0.0;
                } else {
                  let sz2 = 2.0 * len;
                  inCoord = inCoord - sz2 * f32(i32(f32(inCoord / sz2)));
                  if (inCoord >= len) {
                    inCoord = sz2 - inCoord - 1.0;
                  }
                }
              }
              return clamp(inCoord, 0.0, len - 1.0);
            } else if (uniforms.fillModeId == 3) {
              if (inCoord < 0.0) {
                if (len <= 1.0) {
                  inCoord = 0.0;
                } else {
                  let sz = len - 1.0;
                  inCoord = inCoord + len * (f32(i32(f32(-inCoord / sz))) + 1.0);
                }
              } else if (inCoord > len - 1.0) {
                if (len <= 1.0) {
                  inCoord = 0.0;
                } else {
                  let sz = len - 1.0;
                  inCoord = inCoord - len * f32(i32(f32(inCoord / sz)));
                }
              }
              return clamp(inCoord, 0.0, len - 1.0);
            } else if (uniforms.fillModeId == 4) {
              return clamp(outCoord, 0.0, len - 1.0);
            }
            return outCoord;
          }
          fn readWithFillValue(batch : i32, coordY : i32, coordX : i32,
            channel : i32) -> f32 {
            var outputValue : f32;
            if (0 <= coordY && coordY < uniforms.imageShape[1] && 0 <= coordX && coordX < uniforms.imageShape[2]) {
                outputValue = getImage(batch, coordY, coordX, channel);
            } else {
              outputValue = uniforms.fillValue;
            }
            return outputValue;
          }

          ${P("index")} {
            if (index < uniforms.size) {
              let coords = getCoordsFromIndex(index);
              var outputValue : f32;
              let batch = coords[0];
              let x = coords[2];
              let y = coords[1];
              let channel = coords[3];
              let xf = f32(x);
              let yf = f32(y);
              let a1 = getTransforms(batch, 0);
              let a2 = getTransforms(batch, 1);
              let a3 = getTransforms(batch, 2);
              let b1 = getTransforms(batch, 3);
              let b2 = getTransforms(batch, 4);
              let b3 = getTransforms(batch, 5);
              let c1 = getTransforms(batch, 6);
              let c2 = getTransforms(batch, 7);
              let projection = c1 * xf + c2 * yf + 1.0;
              if (projection == 0.0) {
                outputValue = uniforms.fillValue;
              } else {
                let inX = (a1 * xf + a2 * yf + a3) / projection;
                let inY = (b1 * xf + b2 * yf + b3) / projection;
                let mapX = mapCoord(inX, f32(uniforms.imageShape[2]));
                let mapY = mapCoord(inY, f32(uniforms.imageShape[1]));

                if (uniforms.interpolationModeId == 1) {
                  let coordY = i32(round(mapY));
                  let coordX = i32(round(mapX));
                  outputValue = readWithFillValue(batch, coordY, coordX,
                    channel);
                } else {
                  let yFloor = floor(mapY);
                  let xFloor = floor(mapX);
                  let yCeil = yFloor + 1.0;
                  let xCeil = xFloor + 1.0;
                  let valueYFloor = (xCeil - mapX) *
                  readWithFillValue(batch, i32(yFloor), i32(xFloor), channel) +
                  (mapX - xFloor) *
                  readWithFillValue(batch, i32(yFloor), i32(xCeil), channel);
                  let valueYCeil = (xCeil - mapX) *
                  readWithFillValue(batch, i32(yCeil), i32(xFloor), channel) +
                  (mapX - xFloor) *
                  readWithFillValue(batch, i32(yCeil), i32(xCeil), channel);
                  outputValue = (yCeil - mapY) * valueYFloor +
                  (mapY - yFloor) * valueYCeil;
                }
              }
              setOutputAtIndex(index, outputValue);
            }
          }
        `}}let nw={kernelName:Y.Transform,backendName:"webgpu",kernelFunc:function(e){let t,{inputs:i,backend:r,attrs:a}=e,{image:s,transforms:o}=i,{interpolation:n,fillMode:u,fillValue:l,outputShape:d}=a,[h,p,c,f]=s.shape,[m,g]=null!=d?d:[p,c],x=new ny([h,m,g,f]);switch(u){case"constant":default:t=1;break;case"reflect":t=2;break;case"wrap":t=3;break;case"nearest":t=4}let y=[{type:"int32",data:["nearest"===n?1:2]},{type:"int32",data:[t]},{type:"float32",data:[l]}];return r.runWebGPUProgram(x,[s,o],"float32",y)}},nb={kernelName:Y.Unpack,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{value:a}=t,{axis:s}=r;s<0&&(s+=a.shape.length);let o=a.shape.length,n=a.shape[s],u=Array(o-1),l=0;for(let e=0;e<o;e++)e!==s&&(u[l++]=a.shape[e]);let d=[],h=Array(o).fill(0),p=a.shape.slice();p[s]=1;let c=Array(n);for(let e=0;e<c.length;e++){h[s]=e;let t=ru({inputs:{x:a},backend:i,attrs:{begin:h,size:p}}),r=eX({inputs:{x:t},backend:i,attrs:{shape:u}});c[e]=r,d.push(t)}return d.forEach(e=>i.disposeData(e.dataId)),c}};class nC{constructor(e,t,i){if(this.outputShape=[],this.variableNames=["x","segmentIds"],this.uniforms="numSegments : i32, xSize: i32,",this.workgroupSize=[64,1,1],this.atomic=!0,this.outputShape=t,this.dispatchLayout=U(e),this.dispatch=L(this.dispatchLayout,e,this.workgroupSize),"float32"!==i&&"int32"!==i)throw Error(`UnsortedSegmentSum only supports float32 and int32
              types, does not support ${i} type.`);this.type=i,this.shaderKey="unsortedSegmentSum"}getUserCode(){return`
    ${P("index")} {
      if (index < uniforms.xSize) {
        let coords = getXCoordsFromIndex(index);
        let b = coords[0];
        let inCol = coords[1];

        let segmentId = i32(getSegmentIds(inCol));
        if (segmentId >= 0) {
          let flatIndex = b * uniforms.numSegments + segmentId % uniforms.numSegments;
          let value = getX(b, inCol);

          ${I("&result[flatIndex]","value",this.type)}
        }
      }
    }
  `}}for(let e of[eY,iS,iI,iR,iP,iA,iW,iO,iM,iV,iH,iK,iY,iQ,iJ,i9,i7,ri,rr,ra,rd,rf,rg,rS,rI,r$,e1,rA,r_,rU,rX,rq,rj,rQ,rZ,r2,r1,r4,r7,ae,at,ar,ad,ah,an,ac,am,ay,aw,aC,aR,aP,az,aN,aT,a_,aL,aW,aM,eH,aG,aj,aX,aq,aJ,a2,a0,a3,a5,a9,se,e2,st,rT,sr,ss,sn,su,sd,sp,sf,sy,sg,sb,sS,sI,sP,sA,i4,sD,sT,sB,sF,sL,sW,i5,sO,sM,sG,sX,sQ,av,sZ,s2,s0,rw,s3,s5,s8,oe,oi,or,oa,os,rC,on,ol,oh,oc,eK,om,ox,ow,oC,ov,ok,o$,oz,oN,oT,o_,oL,oW,oU,oV,oH,rl,ni,na,ns,sj,oK,oY,o2,o0,o6,o5,o9,o7,nt,nn,ak,nl,nh,np,o4,nx,nw,i_,nb,{kernelName:Y.UnsortedSegmentSum,backendName:"webgpu",kernelFunc:function(e){let{inputs:t,backend:i,attrs:r}=e,{x:a,segmentIds:s}=t,{numSegments:o}=r,n=a.shape.length,u=[],l=0,d=m.backend_util.getAxesPermutation([l],n),h=a;null!=d&&(u.push(h=iF({inputs:{x:a},backend:i,attrs:{perm:d}})),l=m.backend_util.getInnerMostAxes(1,n)[0]);let p=m.backend_util.segment_util.computeOutShape(h.shape,l,o),c=y.util.sizeFromShape([h.shape[l]]),f=eX({inputs:{x:h},backend:i,attrs:{shape:[-1,c]}});u.push(f);let g=a.dtype,x=[f.shape[0],o],w=eG({backend:i,attrs:{shape:x,value:0,dtype:g}}),b=new nC(f.shape,x,g),C=[{type:"int32",data:[o]},{type:"int32",data:[y.util.sizeFromShape(f.shape)]}],S=i.runWebGPUProgram(b,[f,s],g,C,w),v=eX({inputs:{x:S},backend:i,attrs:{shape:p}});u.push(S);let I=v;return null!=d&&(u.push(v),I=iF({inputs:{x:I},backend:i,attrs:{perm:m.backend_util.getUndoAxesPermutation(d)}})),u.forEach(e=>i.disposeData(e.dataId)),I}},s6])(0,q.registerKernel)(e);e.s([],215833),e.i(215833),e.i(86946),e.i(833210),e.s(["WebGPUBackend",0,X,"webgpu_util",0,K],261462),e.i(261462),e.s(["WebGPUBackend",0,X,"webgpu_util",()=>K],850509),e.i(850509),e.s(["WebGPUBackend",0,X,"webgpu_util",()=>K],897823)}]);