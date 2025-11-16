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
  Image,
  Linking
} from 'react-native';
import { useAuth } from '../../utils/AuthContext';
import ApiCaller from '../../api/apiCaller';

const ClientLoginScreen = ({ navigation, onClientLogin }) => {
  const [projectName, setProjectName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { startClientSession } = useAuth();
  
  const handleClientLogin = async () => {
    if (!projectName.trim() || !projectId.trim()) {
      setError('Please fill in all fields');
      return;
    }
    
    setError('');
    setLoading(true);
    
    try {
      // Authenticate with backend
      const data = await ApiCaller(`/authenticate/${encodeURIComponent(projectName)}/${encodeURIComponent(projectId)}`);
      
      if (!data.records || data.records.length === 0) {
        throw new Error('Invalid Project Name or Project ID.');
      }
      
      const projectData = data.records[0];
      
      // Start client session
      await startClientSession(projectData);
      
      // Navigate to project details via callback
      if (onClientLogin) {
        onClientLogin(projectData);
      }
    } catch (error) {
      console.error('Client login error:', error);
      setError(error.message || 'Invalid credentials. Please try again.');
      Alert.alert('Login Failed', error.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleContactSupport = () => {
    const email = 'prakhar.khare@waivergroup.com';
    const subject = 'Support Request - Waiver On-the-go';
    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(subject)}`;
    
    Linking.canOpenURL(mailtoUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(mailtoUrl);
        } else {
          Alert.alert('Error', 'Unable to open email client. Please contact: ' + email);
        }
      })
      .catch((err) => {
        console.error('Error opening email:', err);
        Alert.alert('Error', 'Unable to open email client. Please contact: ' + email);
      });
  };

  const handleGetStarted = () => {
    const url = 'https://waiverprojects.web.app/combined-license-form';
    
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          Alert.alert('Error', 'Unable to open browser. Please visit: ' + url);
        }
      })
      .catch((err) => {
        console.error('Error opening URL:', err);
        Alert.alert('Error', 'Unable to open browser. Please visit: ' + url);
      });
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
          <Text style={styles.subtitle}>Client Login</Text>
          
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Project Name</Text>
            <TextInput
              style={styles.input}
              value={projectName}
              onChangeText={setProjectName}
              placeholder="Enter project name"
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Project ID</Text>
            <TextInput
              style={styles.input}
              value={projectId}
              onChangeText={setProjectId}
              placeholder="Enter project ID"
            />
          </View>
          
          <TouchableOpacity
            style={[styles.button, loading ? styles.buttonDisabled : null]}
            onPress={handleClientLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Logging in...' : 'Login as Client'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.contactSupportButton}
            onPress={handleContactSupport}
          >
            <Text style={styles.contactSupportText}>Contact Support</Text>
          </TouchableOpacity>
          
          <View style={styles.getStartedContainer}>
            <Text style={styles.getStartedText}>
              Don't have a project with Waiver Consulting Group?{' '}
            </Text>
            <TouchableOpacity onPress={handleGetStarted}>
              <Text style={styles.getStartedLink}>Get Started here.</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Back to Consultant Login</Text>
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
  contactSupportButton: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
  },
  contactSupportText: {
    color: '#1976D2',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  getStartedContainer: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  getStartedText: {
    color: '#757575',
    fontSize: 14,
    textAlign: 'center',
  },
  getStartedLink: {
    color: '#1976D2',
    fontSize: 14,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  backButton: {
    marginTop: 8,
    padding: 12,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#1976D2',
    fontSize: 16,
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

export default ClientLoginScreen;