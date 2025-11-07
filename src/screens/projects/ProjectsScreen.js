import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  SafeAreaView,
  StatusBar,
  TextInput,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ApiCaller from '../../api/apiCaller';
import { useAuth } from '../../utils/AuthContext';

const ProjectsScreen = ({ navigation }) => {
  const { userRole } = useAuth();
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    // Filter projects based on search query
    if (searchQuery.trim() === '') {
      setFilteredProjects(projects);
    } else {
      const filtered = projects.filter(project => 
        project.fields?.['Project Name']?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.fields?.['Project ID']?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.fields?.['Status']?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredProjects(filtered);
    }
  }, [searchQuery, projects]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try to fetch real projects from the API
      try {
        const data = await ApiCaller('/records/projects');
        const projectsList = data.records || [];
        setProjects(projectsList);
        setFilteredProjects(projectsList);
      } catch (apiError) {
        console.log('API fetch failed, using sample data:', apiError);
        
        // Fallback to sample data if API fails
        const sampleProjects = [
          {
            id: 'rec1',
            fields: {
              'Project Name': 'Sample Project Alpha',
              'Project ID': 'ALPHA-001',
              'Status': 'In Progress',
              'Project Type': 'Tax Preparation',
              'Assigned Consultant': 'John Doe',
              'Client Email': 'client@example.com'
            }
          },
          {
            id: 'rec2',
            fields: {
              'Project Name': 'Sample Project Beta',
              'Project ID': 'BETA-002',
              'Status': 'Completed',
              'Project Type': 'Audit Support',
              'Assigned Consultant': 'Jane Smith',
              'Client Email': 'client2@example.com'
            }
          },
          {
            id: 'rec3',
            fields: {
              'Project Name': 'Sample Project Gamma',
              'Project ID': 'GAMMA-003',
              'Status': 'Not Started',
              'Project Type': 'Consulting',
              'Assigned Consultant': 'Bob Johnson',
              'Client Email': 'client3@example.com'
            }
          }
        ];
        
        setProjects(sampleProjects);
        setFilteredProjects(sampleProjects);
      }
    } catch (err) {
      console.error('Failed to fetch projects:', err);
      setError('Failed to load projects');
      Alert.alert('Error', 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProjects();
    setRefreshing(false);
  };

  const handleProjectPress = (project) => {
    navigation.navigate('ProjectDetails', {
      projectId: project.id,
      projectName: project.fields?.['Project Name']
    });
  };

  const handleProjectEdit = (project) => {
    navigation.navigate('ProjectDetails', {
      projectId: project.id,
      projectName: project.fields?.['Project Name'],
      startInEdit: true,
    });
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return '#10B981'; // Green
      case 'in progress':
        return '#F59E0B'; // Yellow
      case 'not started':
        return '#6B7280'; // Gray
      default:
        return '#6B7280';
    }
  };

  const renderProjectItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.projectCard}
      onPress={() => handleProjectPress(item)}
    >
      <View style={styles.projectHeader}>
        <View style={styles.projectInfo}>
          <Text style={styles.projectName} numberOfLines={1}>
            {item.fields?.['Project Name'] || 'Unnamed Project'}
          </Text>
          <Text style={styles.projectId}>
            {item.fields?.['Project ID'] || 'N/A'}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.fields?.Status) }]}>
          <Text style={styles.statusText}>
            {item.fields?.Status || 'Unknown'}
          </Text>
        </View>
      </View>
      
      <View style={styles.projectDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="person" size={16} color="#6B7280" />
          <Text style={styles.detailText}>
            {item.fields?.['Assigned Consultant'] || 'Unassigned'}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="document-text" size={16} color="#6B7280" />
          <Text style={styles.detailText}>
            {item.fields?.['Project Type'] || 'N/A'}
          </Text>
        </View>
      </View>
      
      <View style={styles.projectFooter}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity onPress={() => handleProjectEdit(item)}>
            <Ionicons name="create" size={20} color="#6B7280" />
          </TouchableOpacity>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="folder-open" size={64} color="#D1D5DB" />
      <Text style={styles.emptyTitle}>No Projects Found</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery ? 'Try adjusting your search terms' : 'Projects will appear here when available'}
      </Text>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading projects...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search projects..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Projects List */}
      <FlatList
        data={filteredProjects}
        renderItem={renderProjectItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#3B82F6']}
            tintColor="#3B82F6"
          />
        }
        ListEmptyComponent={renderEmptyState}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
  },
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  projectCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  projectInfo: {
    flex: 1,
    marginRight: 12,
  },
  projectName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  projectId: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'monospace',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'white',
  },
  projectDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#6B7280',
  },
  projectFooter: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});

export default ProjectsScreen;