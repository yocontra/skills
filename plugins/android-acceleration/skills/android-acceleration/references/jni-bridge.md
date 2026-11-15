# JNI bridge for C++ inference engines

For running llama.cpp, whisper.cpp or a custom C++ engine from Kotlin.

## Kotlin side

```kotlin
class NativeInference private constructor(
    private var nativePtr: Long
) : AutoCloseable {

    companion object {
        init { System.loadLibrary("inference") }

        fun create(modelPath: String): NativeInference {
            val ptr = nativeCreate(modelPath)
            if (ptr == 0L) throw RuntimeException("Failed to load model")
            return NativeInference(ptr)
        }

        @JvmStatic private external fun nativeCreate(path: String): Long
        @JvmStatic private external fun nativeInfer(ptr: Long, input: FloatArray): FloatArray
        @JvmStatic private external fun nativeDestroy(ptr: Long)
    }

    fun infer(input: FloatArray): FloatArray {
        check(nativePtr != 0L) { "Model already destroyed" }
        return nativeInfer(nativePtr, input)
    }

    override fun close() {
        if (nativePtr != 0L) {
            nativeDestroy(nativePtr)
            nativePtr = 0
        }
    }
}

// Usage: automatic cleanup
NativeInference.create(modelPath).use { model ->
    val output = model.infer(inputData)
}
```

## C++ side

```cpp
#include <jni.h>
#include "model.h"  // your inference engine

extern "C" {

JNIEXPORT jlong JNICALL
Java_com_example_NativeInference_nativeCreate(JNIEnv *env, jclass, jstring path) {
    const char *modelPath = env->GetStringUTFChars(path, nullptr);
    auto *model = new Model(modelPath);
    env->ReleaseStringUTFChars(path, modelPath);
    return reinterpret_cast<jlong>(model);
}

JNIEXPORT jfloatArray JNICALL
Java_com_example_NativeInference_nativeInfer(JNIEnv *env, jclass, jlong ptr, jfloatArray input) {
    auto *model = reinterpret_cast<Model *>(ptr);

    jfloat *inputData = env->GetFloatArrayElements(input, nullptr);
    jsize inputLen = env->GetArrayLength(input);

    std::vector<float> output = model->infer(inputData, inputLen);
    env->ReleaseFloatArrayElements(input, inputData, JNI_ABORT);  // read-only: no copy-back

    jfloatArray result = env->NewFloatArray(output.size());
    env->SetFloatArrayRegion(result, 0, output.size(), output.data());
    return result;
}

JNIEXPORT void JNICALL
Java_com_example_NativeInference_nativeDestroy(JNIEnv *, jclass, jlong ptr) {
    delete reinterpret_cast<Model *>(ptr);
}

}  // extern "C"
```

## Rules

1. Use `ByteBuffer.allocateDirect()` for large transfers to avoid JNI copy overhead.
2. `JNIEnv*` is thread-local. For multi-threaded C++, keep the `JavaVM` and call
   `GetEnv()` (or attach the thread) on each thread.
3. Pair every create with a destroy; native pointers are manual memory management.
   Implement `AutoCloseable` and use `use {}` or try-finally so leaks cannot happen.
4. Pass `JNI_ABORT` to `ReleaseFloatArrayElements` when you only read the array.
5. Do not hold local JNI references across threads; promote with `NewGlobalRef` when
   you need to.

## CMake

```cmake
# CMakeLists.txt
cmake_minimum_required(VERSION 3.18)
project(inference)

add_library(inference SHARED
    jni_bridge.cpp
    model.cpp
)

target_link_libraries(inference
    android
    log
)
```

```kotlin
// build.gradle.kts
android {
    externalNativeBuild {
        cmake {
            path = file("src/main/cpp/CMakeLists.txt")
        }
    }
}
```
