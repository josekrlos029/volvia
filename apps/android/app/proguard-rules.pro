# kotlinx-serialization ships its own consumer rules for @Serializable classes; these keep
# the generated serializers of the API models explicitly so a future R8 change can't
# strip them and turn every response into a crash.
-keepattributes *Annotation*, InnerClasses
-keep,includedescriptorclasses class co.volvia.biz.**$$serializer { *; }
-keepclassmembers class co.volvia.biz.** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}

# Credential Manager loads the Play Services provider by reflection.
-if class androidx.credentials.CredentialManager
-keep class androidx.credentials.playservices.** { *; }
