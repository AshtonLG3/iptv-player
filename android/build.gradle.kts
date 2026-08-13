import java.util.Properties
import org.gradle.api.tasks.Sync

plugins {
    id("com.android.application")
}

val appVersionCode = 36
val appVersionName = "1.6.9"
val generatedWebAssetsDir = layout.buildDirectory.dir("generated/web-assets")
val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties().apply {
    if (keystorePropertiesFile.isFile) {
        keystorePropertiesFile.inputStream().use(::load)
    }
}
val releaseSigningKeys = listOf("storeFile", "storePassword", "keyAlias", "keyPassword")
val hasReleaseSigning = releaseSigningKeys.all { !keystoreProperties.getProperty(it).isNullOrBlank() }

val syncWebAssets by tasks.registering(Sync::class) {
    from(rootProject.projectDir) {
        include("index.html")
        include("style.css")
        include("app.js")
        include("assets/**")
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

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = rootProject.file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
                enableV1Signing = true
                enableV2Signing = true
            }
        }
    }

    buildTypes {
        getByName("release") {
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
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

val verifyReleaseSigning by tasks.registering {
    doLast {
        check(hasReleaseSigning) {
            "Release signing is not configured. Copy keystore.properties.example to keystore.properties and provide the private signing values."
        }
    }
}

tasks.named("preBuild") {
    dependsOn(syncWebAssets)
}

tasks.matching { it.name == "preReleaseBuild" }.configureEach {
    dependsOn(verifyReleaseSigning)
}

dependencies {
    implementation("androidx.core:core:1.13.1")
    implementation("androidx.webkit:webkit:1.15.0")
    implementation("androidx.media3:media3-common:1.4.1")
    implementation("androidx.media3:media3-datasource:1.4.1")
    implementation("androidx.media3:media3-exoplayer:1.4.1")
    implementation("androidx.media3:media3-exoplayer-hls:1.4.1")
    implementation("androidx.media3:media3-ui:1.4.1")
    testImplementation("junit:junit:4.13.2")
}
