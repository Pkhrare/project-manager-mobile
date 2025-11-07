import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  KeyboardAvoidingView, 
  Platform,
  ScrollView,
  Alert,
  Image
} from 'react-native';
import { useAuth } from '../../utils/AuthContext';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { loginWithEmail, signInWithGoogle } = useAuth();
  
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      await loginWithEmail(email, password);
      // Navigation will happen automatically via App.js when auth state changes
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error.code === 'auth/invalid-credential' 
        ? 'Invalid email or password'
        : error.code === 'auth/user-not-found'
        ? 'No account found with this email'
        : error.code === 'auth/wrong-password'
        ? 'Incorrect password'
        : 'Login failed. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    
    try {
      await signInWithGoogle();
      // Navigation will happen automatically via App.js when auth state changes
    } catch (error) {
      console.error('Google Sign-In error:', error);
      const errorMessage = error.message?.includes('Firebase not initialized')
        ? 'Authentication system not ready. Please try again.'
        : error.code === 'SIGN_IN_CANCELLED'
        ? 'Sign in cancelled'
        : error.code === 'IN_PROGRESS'
        ? 'Sign in already in progress'
        : error.message || 'Google Sign-In failed. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  const navigateToClientLogin = () => {
    navigation.navigate('ClientLogin');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.formContainer}>
          {/* Company Logo Section */}
          <View style={styles.logoContainer}>
            <View style={styles.companyNameContainer}>
              <Image 
                source={require('../../../assets/company_logo.avif')} 
                style={styles.companyNameLogo}
                resizeMode="contain"
              />
            </View>
          </View>
          
          <Text style={styles.title}>Project Manager</Text>
          <Text style={styles.subtitle}>Consultant Login</Text>
          
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
            />
          </View>
          
          <TouchableOpacity
            style={[styles.button, loading ? styles.buttonDisabled : null]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Logging in...' : 'Login'}
            </Text>
          </TouchableOpacity>

          {/* Google Sign-In temporarily disabled - requires OAuth setup */}
          {/* Uncomment after setting up Google OAuth in Firebase Console */}
          {/* 
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.googleButton, loading ? styles.buttonDisabled : null]}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            <Text style={styles.googleIcon}>G</Text>
            <Text style={styles.googleButtonText}>Sign in with Google</Text>
          </TouchableOpacity>
          */}
          
          <TouchableOpacity
            style={styles.clientButton}
            onPress={navigateToClientLogin}
          >
            <Text style={styles.clientButtonText}>Client Login</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    padding: 20,
    borderRadius: 10,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#F7B76E',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#757575',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorText: {
    color: '#D32F2F',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#212121',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#BDBDBD',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#F5F5F5',
  },
  button: {
    backgroundColor: '#1976D2',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  clientButton: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
  },
  clientButtonText: {
    color: '#1976D2',
    fontSize: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#757575',
    fontSize: 14,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginBottom: 16,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4285F4',
    marginRight: 12,
  },
  googleButtonText: {
    color: '#757575',
    fontSize: 16,
    fontWeight: '600',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  companyNameContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  companyNameLogo: {
    width: 290,
    height: 60,
  },
});

export default LoginScreen;