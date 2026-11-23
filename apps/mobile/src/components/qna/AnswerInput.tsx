import { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Image,
    ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@/hooks/useTheme';
import { usePremium } from '@/hooks/usePremium';
import { useQnaQuota } from '@/hooks/useQna';
import { Ionicons } from '@expo/vector-icons';
import { qnaService } from '@/services/api';

interface AnswerInputProps {
    onSubmit: (content: string, imageUrls?: string[]) => Promise<void>;
    onCancel: () => void;
    isSubmitting?: boolean;
    placeholder?: string;
    minLength?: number;
    maxLength?: number;
}

export function AnswerInput({
    onSubmit,
    onCancel,
    isSubmitting = false,
    placeholder = 'Cevabınızı yazın... (En az 3 karakter)',
    minLength = 3,
    maxLength = 5000,
}: AnswerInputProps) {
    const theme = useTheme();
    const { isPremium } = usePremium();
    const { data: qnaQuota } = useQnaQuota();
    const weeklyImageLimit = qnaQuota?.imageLimit ?? (isPremium ? 5 : 2);
    const maxImages = qnaQuota?.imageRemaining ?? weeklyImageLimit;
    const styles = createStyles(theme);
    const [content, setContent] = useState('');
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [isUploadingImages, setIsUploadingImages] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const characterCount = content.length;
    const isValid = characterCount >= minLength && characterCount <= maxLength;
    const showWarning = characterCount > maxLength * 0.9;

    const handlePickImage = async () => {
        if (selectedImages.length >= maxImages) {
            setError(
                isPremium
                    ? `Haftalık kalan resim hakkınız: ${maxImages}/${weeklyImageLimit} (hafta bitiminde sıfırlanır)`
                    : `Ücretsiz üyeler haftada ${weeklyImageLimit} resim ekleyebilir (kalan: ${maxImages} · Premium ile 5)`,
            );
            return;
        }
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            setError('Galeri izni gerekli');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.8,
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
            setSelectedImages((prev) => [...prev, result.assets[0].uri].slice(0, maxImages));
            setError(null);
        }
    };

    const handleRemoveImage = (idx: number) => {
        setSelectedImages((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleSubmit = async () => {
        setError(null);

        if (!content.trim()) {
            setError('Lütfen cevap içeriğini girin');
            return;
        }

        if (characterCount < minLength) {
            setError(`Cevap en az ${minLength} karakter olmalıdır`);
            return;
        }

        if (characterCount > maxLength) {
            setError(`Cevap en fazla ${maxLength} karakter olabilir`);
            return;
        }

        try {
            let uploadedUrls: string[] | undefined;
            if (selectedImages.length > 0) {
                setIsUploadingImages(true);
                const results = await Promise.all(
                    selectedImages.map((uri) => qnaService.uploadImage(uri)),
                );
                uploadedUrls = results.map((r) => r.imageUrl);
                setIsUploadingImages(false);
            }
            await onSubmit(content.trim(), uploadedUrls);
            setContent('');
            setSelectedImages([]);
            setError(null);
        } catch (err: any) {
            setIsUploadingImages(false);
            setError(err.message || 'Cevap gönderilemedi');
        }
    };

    const handleCancel = () => {
        setContent('');
        setSelectedImages([]);
        setError(null);
        onCancel();
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.container}
        >
            <View style={styles.inputContainer}>
                <TextInput
                    style={[
                        styles.input,
                        error && styles.inputError,
                    ]}
                    placeholder={placeholder}
                    placeholderTextColor={theme.colors.textLight}
                    value={content}
                    onChangeText={(text) => {
                        setContent(text);
                        setError(null);
                    }}
                    multiline
                    numberOfLines={6}
                    textAlignVertical="top"
                    maxLength={maxLength}
                    editable={!isSubmitting}
                />

                {/* Character Count */}
                <View style={styles.footer}>
                    <View style={styles.characterCountContainer}>
                        <Text
                            style={[
                                styles.characterCount,
                                showWarning && styles.characterCountWarning,
                                characterCount > maxLength && styles.characterCountError,
                            ]}
                        >
                            {characterCount} / {maxLength}
                        </Text>
                        {characterCount < minLength && characterCount > 0 && (
                            <Text style={styles.minLengthHint}>
                                (En az {minLength} karakter gerekli)
                            </Text>
                        )}
                    </View>

                    {error && (
                        <View style={styles.errorContainer}>
                            <Ionicons name="alert-circle" size={14} color={theme.colors.error} />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}
                </View>

                {/* Selected Images Preview */}
                {selectedImages.length > 0 && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.imagesPreviewRow}
                    >
                        {selectedImages.map((uri, idx) => (
                            <View key={`${uri}-${idx}`} style={styles.imagePreviewBox}>
                                <Image source={{ uri }} style={styles.imagePreview} />
                                <TouchableOpacity
                                    style={styles.removeImageBtn}
                                    onPress={() => handleRemoveImage(idx)}
                                >
                                    <Ionicons name="close-circle" size={18} color="#EF4444" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>
                )}

                {/* Action Buttons */}
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={styles.addImageBtn}
                        onPress={handlePickImage}
                        disabled={isSubmitting || isUploadingImages || selectedImages.length >= maxImages}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="image-outline" size={18} color={theme.colors.primary} />
                        <Text style={styles.addImageBtnText}>Resim ({selectedImages.length}/{maxImages})</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={handleCancel}
                        disabled={isSubmitting || isUploadingImages}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.cancelButtonText}>İptal</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.submitButton,
                            (!isValid || isSubmitting || isUploadingImages) && styles.submitButtonDisabled,
                        ]}
                        onPress={handleSubmit}
                        disabled={!isValid || isSubmitting || isUploadingImages}
                        activeOpacity={0.7}
                    >
                        {isSubmitting || isUploadingImages ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="send" size={18} color="#fff" />
                                <Text style={styles.submitButtonText}>Gönder</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const createStyles = (theme: ReturnType<typeof useTheme>) =>
    StyleSheet.create({
        container: {
            width: '100%',
        },
        inputContainer: {
            backgroundColor: theme.colors.backgroundCard,
            borderRadius: 16,
            padding: theme.spacing.lg,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
        },
        input: {
            backgroundColor: theme.colors.background,
            borderRadius: 12,
            padding: theme.spacing.md,
            fontSize: 15,
            color: theme.colors.text,
            borderWidth: 1,
            borderColor: theme.colors.border,
            minHeight: 120,
            maxHeight: 200,
            textAlignVertical: 'top',
        },
        inputError: {
            borderColor: theme.colors.error,
        },
        imagesPreviewRow: {
            flexDirection: 'row',
            gap: 8,
            marginTop: 10,
        },
        imagePreviewBox: {
            position: 'relative',
        },
        imagePreview: {
            width: 64,
            height: 64,
            borderRadius: 10,
        },
        removeImageBtn: {
            position: 'absolute',
            top: -6,
            right: -6,
            backgroundColor: '#FFFFFF',
            borderRadius: 10,
        },
        addImageBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: theme.colors.primary + '15',
            marginRight: 'auto',
        },
        addImageBtnText: {
            fontSize: 12,
            fontWeight: '600',
            color: theme.colors.primary,
        },
        footer: {
            marginTop: theme.spacing.sm,
            gap: theme.spacing.xs,
        },
        characterCountContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: theme.spacing.xs,
        },
        characterCount: {
            fontSize: 12,
            color: theme.colors.textSecondary,
        },
        minLengthHint: {
            fontSize: 11,
            color: theme.colors.textLight,
            fontStyle: 'italic',
        },
        characterCountWarning: {
            color: theme.colors.warning || '#F59E0B',
        },
        characterCountError: {
            color: theme.colors.error,
            fontWeight: '600',
        },
        errorContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: theme.spacing.xs,
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderRadius: 8,
        },
        errorText: {
            fontSize: 12,
            color: theme.colors.error,
            flex: 1,
        },
        actions: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: theme.spacing.sm,
            marginTop: theme.spacing.md,
        },
        cancelButton: {
            paddingHorizontal: theme.spacing.lg,
            paddingVertical: theme.spacing.sm,
            borderRadius: 12,
            backgroundColor: theme.colors.background,
            borderWidth: 1,
            borderColor: theme.colors.border,
        },
        cancelButtonText: {
            fontSize: 15,
            fontWeight: '600',
            color: theme.colors.textSecondary,
        },
        submitButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: theme.spacing.xl,
            paddingVertical: theme.spacing.sm,
            borderRadius: 12,
            backgroundColor: theme.colors.primary,
            minWidth: 100,
            justifyContent: 'center',
        },
        submitButtonDisabled: {
            opacity: 0.5,
        },
        submitButtonText: {
            fontSize: 15,
            fontWeight: '600',
            color: '#fff',
        },
    });
