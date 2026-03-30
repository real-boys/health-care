import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  FlatList,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { fetchProviders, searchProviders, setFilters, clearFilters } from '../store/slices/providerSlice';

const { width, height } = Dimensions.get('window');

const ProviderDirectoryScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const dispatch = useDispatch();
  const { providers, searchResults, isLoading, hasSearched, filters } = useSelector(
    (state) => state.providers
  );

  const displayProviders = hasSearched ? searchResults : providers;

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      await dispatch(fetchProviders()).unwrap();
    } catch (error) {
      console.log('Error loading providers:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProviders();
    setRefreshing(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      dispatch(clearFilters());
      return;
    }

    try {
      await dispatch(searchProviders({ q: searchQuery, ...filters })).unwrap();
    } catch (error) {
      console.log('Error searching providers:', error);
    }
  };

  const handleFilterChange = (filterType, value) => {
    dispatch(setFilters({ [filterType]: value }));
  };

  const clearAllFilters = () => {
    dispatch(clearFilters());
    setSearchQuery('');
  };

  const specialties = [
    'All Specialties',
    'Cardiology',
    'Neurology',
    'Pediatrics',
    'Orthopedics',
    'Dermatology',
    'Psychiatry',
    'General Practice',
    'Oncology',
    'Gynecology',
  ];

  const ratingOptions = ['All Ratings', '4.5+ Stars', '4+ Stars', '3.5+ Stars'];
  const priceRanges = ['All Prices', '$0-$200', '$200-$300', '$300-$400', '$400+'];

  const ProviderCard = ({ provider }) => (
    <TouchableOpacity
      style={styles.providerCard}
      onPress={() => navigation.navigate('ProviderDetail', { providerId: provider.id })}
    >
      <View style={styles.providerHeader}>
        <View style={styles.providerAvatar}>
          <Text style={styles.avatarText}>{provider.name.charAt(0)}</Text>
        </View>
        <View style={styles.providerInfo}>
          <Text style={styles.providerName}>{provider.name}</Text>
          <Text style={styles.providerSpecialty}>{provider.specialty}</Text>
          <View style={styles.providerRating}>
            <Icon name="star" size={16} color="#f59e0b" />
            <Text style={styles.ratingText}>{provider.rating}</Text>
            <Text style={styles.reviewCount}>({provider.reviews} reviews)</Text>
          </View>
        </View>
        {provider.verified && (
          <View style={styles.verifiedBadge}>
            <Icon name="verified" size={16} color="#10b981" />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        )}
      </View>

      <View style={styles.providerDetails}>
        <View style={styles.detailRow}>
          <Icon name="location-on" size={16} color="#6b7280" />
          <Text style={styles.detailText} numberOfLines={1}>
            {provider.location}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Icon name="local-hospital" size={16} color="#6b7280" />
          <Text style={styles.detailText}>{provider.hospital}</Text>
        </View>
        <View style={styles.detailRow}>
          <Icon name="work" size={16} color="#6b7280" />
          <Text style={styles.detailText}>{provider.experience} years experience</Text>
        </View>
      </View>

      <View style={styles.providerFooter}>
        <View style={styles.priceContainer}>
          <Icon name="attach-money" size={20} color="#2563eb" />
          <Text style={styles.priceText}>{provider.price}</Text>
        </View>
        <TouchableOpacity
          style={styles.bookBtn}
          onPress={() => navigation.navigate('Booking', { providerId: provider.id })}
        >
          <Text style={styles.bookBtnText}>Book Now</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const FilterModal = () => (
    <View style={styles.filterModal}>
      <View style={styles.filterHeader}>
        <Text style={styles.filterTitle}>Filters</Text>
        <TouchableOpacity onPress={() => setShowFilters(false)}>
          <Icon name="close" size={24} color="#6b7280" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.filterContent}>
        <View style={styles.filterSection}>
          <Text style={styles.filterSectionTitle}>Specialty</Text>
          <View style={styles.filterOptions}>
            {specialties.map((specialty) => (
              <TouchableOpacity
                key={specialty}
                style={[
                  styles.filterOption,
                  filters.specialty === specialty && styles.selectedFilter,
                ]}
                onPress={() => handleFilterChange('specialty', specialty)}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    filters.specialty === specialty && styles.selectedFilterText,
                  ]}
                >
                  {specialty}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.filterSection}>
          <Text style={styles.filterSectionTitle}>Rating</Text>
          <View style={styles.filterOptions}>
            {ratingOptions.map((rating) => (
              <TouchableOpacity
                key={rating}
                style={[
                  styles.filterOption,
                  filters.rating === rating && styles.selectedFilter,
                ]}
                onPress={() => handleFilterChange('rating', rating)}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    filters.rating === rating && styles.selectedFilterText,
                  ]}
                >
                  {rating}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.filterSection}>
          <Text style={styles.filterSectionTitle}>Price Range</Text>
          <View style={styles.filterOptions}>
            {priceRanges.map((price) => (
              <TouchableOpacity
                key={price}
                style={[
                  styles.filterOption,
                  filters.priceRange === price && styles.selectedFilter,
                ]}
                onPress={() => handleFilterChange('priceRange', price)}
              >
                <Text
                  style={[
                    styles.filterOptionText,
                    filters.priceRange === price && styles.selectedFilterText,
                  ]}
                >
                  {price}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.filterFooter}>
        <TouchableOpacity style={styles.clearFiltersBtn} onPress={clearAllFilters}>
          <Text style={styles.clearFiltersText}>Clear All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.applyFiltersBtn}
          onPress={() => {
            setShowFilters(false);
            handleSearch();
          }}
        >
          <Text style={styles.applyFiltersText}>Apply Filters</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Find Providers</Text>
        <Text style={styles.subtitle}>Search and book with qualified healthcare providers</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#6b7280" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, specialty, or hospital..."
          placeholderTextColor="#9ca3af"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilters(true)}>
          <Icon name="filter-list" size={20} color="#2563eb" />
        </TouchableOpacity>
      </View>

      {/* Active Filters */}
      {(filters.specialty !== '' || filters.rating !== '' || filters.priceRange !== '') && (
        <View style={styles.activeFilters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {filters.specialty !== '' && (
              <TouchableOpacity
                style={styles.activeFilter}
                onPress={() => handleFilterChange('specialty', '')}
              >
                <Text style={styles.activeFilterText}>{filters.specialty}</Text>
                <Icon name="close" size={16} color="#2563eb" />
              </TouchableOpacity>
            )}
            {filters.rating !== '' && (
              <TouchableOpacity
                style={styles.activeFilter}
                onPress={() => handleFilterChange('rating', '')}
              >
                <Text style={styles.activeFilterText}>{filters.rating}</Text>
                <Icon name="close" size={16} color="#2563eb" />
              </TouchableOpacity>
            )}
            {filters.priceRange !== '' && (
              <TouchableOpacity
                style={styles.activeFilter}
                onPress={() => handleFilterChange('priceRange', '')}
              >
                <Text style={styles.activeFilterText}>{filters.priceRange}</Text>
                <Icon name="close" size={16} color="#2563eb" />
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      )}

      {/* Results Count */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsCount}>
          {displayProviders.length} providers found
        </Text>
        <TouchableOpacity onPress={onRefresh}>
          <Icon name="refresh" size={20} color="#2563eb" />
        </TouchableOpacity>
      </View>

      {/* Providers List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading providers...</Text>
        </View>
      ) : (
        <FlatList
          data={displayProviders}
          renderItem={({ item }) => <ProviderCard provider={item} />}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.providersList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="search-off" size={48} color="#9ca3af" />
              <Text style={styles.emptyText}>No providers found</Text>
              <Text style={styles.emptySubtext}>Try adjusting your search or filters</Text>
            </View>
          }
        />
      )}

      {/* Filter Modal */}
      {showFilters && (
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackground}
            activeOpacity={1}
            onPress={() => setShowFilters(false)}
          />
          <FilterModal />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
  },
  filterBtn: {
    padding: 8,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
  },
  activeFilters: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  activeFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  activeFilterText: {
    fontSize: 14,
    color: '#2563eb',
    marginRight: 6,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  resultsCount: {
    fontSize: 16,
    color: '#6b7280',
  },
  providersList: {
    paddingHorizontal: 20,
  },
  providerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  providerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  providerSpecialty: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  providerRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  ratingText: {
    fontSize: 14,
    color: '#1f2937',
    marginLeft: 4,
    fontWeight: '500',
  },
  reviewCount: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: '#10b981',
    marginLeft: 4,
  },
  providerDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  detailText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
    flex: 1,
  },
  providerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2563eb',
    marginLeft: 4,
  },
  bookBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  bookBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  filterModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  filterContent: {
    flex: 1,
    padding: 20,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  selectedFilter: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  selectedFilterText: {
    color: '#ffffff',
  },
  filterFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  clearFiltersBtn: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingVertical: 12,
    marginRight: 8,
  },
  clearFiltersText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  applyFiltersBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    marginLeft: 8,
  },
  applyFiltersText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '500',
  },
});

export default ProviderDirectoryScreen;
