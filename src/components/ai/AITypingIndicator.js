import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AITypingIndicator = ({ isTyping, style = {} }) => {
    if (!isTyping) return null;

    const bounceAnimation = new Animated.Value(0);

    React.useEffect(() => {
        const bounce = () => {
            Animated.sequence([
                Animated.timing(bounceAnimation, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                }),
                Animated.timing(bounceAnimation, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                if (isTyping) {
                    bounce();
                }
            });
        };

        if (isTyping) {
            bounce();
        }
    }, [isTyping, bounceAnimation]);

    const dot1TranslateY = bounceAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -8],
    });

    const dot2TranslateY = bounceAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -8],
    });

    const dot3TranslateY = bounceAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -8],
    });

    return (
        <View style={[styles.container, style]}>
            <View style={styles.messageContainer}>
                <View style={styles.header}>
                    <View style={styles.avatarContainer}>
                        <Ionicons name="code-slash" size={16} color="white" />
                    </View>
                    <Text style={styles.name}>Waiverlyn</Text>
                </View>
                
                <View style={styles.typingContainer}>
                    <View style={styles.dotsContainer}>
                        <Animated.View 
                            style={[
                                styles.dot, 
                                { transform: [{ translateY: dot1TranslateY }] }
                            ]} 
                        />
                        <Animated.View 
                            style={[
                                styles.dot, 
                                { transform: [{ translateY: dot2TranslateY }] }
                            ]} 
                        />
                        <Animated.View 
                            style={[
                                styles.dot, 
                                { transform: [{ translateY: dot3TranslateY }] }
                            ]} 
                        />
                    </View>
                    <Text style={styles.typingText}>analyzing...</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'flex-start',
        marginVertical: 4,
    },
    messageContainer: {
        backgroundColor: '#F3E8FF',
        borderColor: '#C084FC',
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        maxWidth: '80%',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 1,
        },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    avatarContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#7C3AED',
        justifyContent: 'center',
        alignItems: 'center',
    },
    name: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B21A8',
    },
    typingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dotsContainer: {
        flexDirection: 'row',
        gap: 4,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#7C3AED',
    },
    typingText: {
        fontSize: 12,
        color: '#7C3AED',
        fontWeight: '500',
    },
});

export default AITypingIndicator;
