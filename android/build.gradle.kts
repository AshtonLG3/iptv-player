import org.gradle.api.tasks.Sync

plugins {
    id("com.android.application")
}

val appVersionCode = 6
val appVersionName = "1.2.3"
val generatedWebAssetsDir = layout.buildDirectory.dir("generated/web-assets")

val syncWebAssets by tasks.registering(Sync::class) {
    from(rootProject.projectDir) {
        include("index.html")
        include("style.css")
        include("app.js")
        include("src/**")
        include("playlists/**")
    }
    into(generatedWebAssetsDir)
}

android {
    namespace = "com.mangezi.ftaiptv"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.mangezi.ftaiptv"
        minSdk = 23
        targetSdk = 35
        versionCode = appVersionCode
        versionName = appVersionName
    }

    buildFeatures {
        buildConfig = true
    }

    sourceSets {
        getByName("main") {
            assets.srcDir(generatedWebAssetsDir)
        }
    }
}

tasks.named("preBuild") {
    dependsOn(syncWebAssets)
}

dependencies {
    implementation("androidx.webkit:webkit:1.6.1")
}
