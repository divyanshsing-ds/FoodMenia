import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Dimensions,
  Image,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { menuAPI } from '../services/api';
import { CONFIG } from '../utils/config';
import { COLORS, RADIUS, SPACING } from '../utils/theme';
import { useCart } from '../services/CartContext';
import { useTokens } from '../services/storage';
import MenuItemCard from '../components/MenuItemCard';

const { width } = Dimensions.get('window');

const BrowseScreen = ({ navigation }) => {
  const { cart } = useCart();
  const { getUserData } = useTokens();
  const [user, setUser] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [restaurantGroups, setRestaurantGroups] = useState([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [foodTypeFilter, setFoodTypeFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const data = await getUserData("user");
    setUser(data);
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchMenu();
    }, [])
  );


  const fetchMenu = async () => {
    setLoading(true);
    try {
      const response = await menuAPI.getMenu();
      if (response.data.success) {
        setMenuItems(response.data.data);
        const groups = response.data.data.reduce((acc, item) => {
          const key = `${item.operatorId}__${item.restaurantName}`;
          if (!acc[key]) {
            acc[key] = {
              operatorId: item.operatorId,
              restaurantName: item.restaurantName,
              items: [],
            };
          }
          acc[key].items.push(item);
          return acc;
        }, {});
        setRestaurantGroups(Object.values(groups));
      }
    } catch (error) {
      console.error('Failed to fetch menu:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRestaurants = restaurantGroups.filter(group => {
    if (foodTypeFilter !== 'all') {
      const hasType = group.items.some(item => 
        (foodTypeFilter === 'veg' && (item.foodType === 'veg' || item.foodType === 'both')) ||
        (foodTypeFilter === 'non-veg' && item.foodType === 'non-veg')
      );
      if (!hasType) return false;
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return group.restaurantName.toLowerCase().includes(q) ||
      group.items.some(item => 
        item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
      );
  });

  const filteredMenu = selectedRestaurant ? selectedRestaurant.items.filter(item => {
    if (foodTypeFilter !== 'all' && item.foodType !== foodTypeFilter && item.foodType !== 'both') return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
  }) : [];

  const renderRestaurant = ({ item }) => {
    const firstItem = item.items.find(i => i.image);
    const imageUrl = firstItem ? `${CONFIG.UPLOADS_BASE}${firstItem.image}` : null;
    
    return (
      <TouchableOpacity 
        style={styles.restaurantCard} 
        onPress={() => setSelectedRestaurant(item)}
        activeOpacity={0.9}
      >
        <View style={styles.imageOverlay}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.restaurantImage} />
          ) : (
            <View style={styles.restaurantPlaceholder}>
              <Text style={styles.placeholderText}>{item.restaurantName[0]}</Text>
            </View>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.85)']}
            style={styles.restaurantGradient}
          />
        </View>
        <View style={styles.restaurantInfo}>
          <Text style={styles.restaurantName} numberOfLines={1}>{item.restaurantName}</Text>
          <Text style={styles.restaurantTags}>
            {item.items.length} dishes • {item.items[0]?.category || 'Food'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[COLORS.bgDeep, '#0e0e25']}
        style={StyleSheet.absoluteFill}
      />
      
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome back,</Text>
          <Text style={styles.title}>{user?.fullName?.split(' ')[0] || 'Foodie'} 🍕</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.cartBtn} 
            onPress={() => navigation.navigate('Cart')}
          >
            <Icon name="shopping-cart" size={26} color={COLORS.textPrimary} />
            {cart.length > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cart.length}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.avatar} 
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.avatarText}>{user?.fullName?.charAt(0) || 'U'}</Text>
          </TouchableOpacity>
        </View>
      </View>


      <View style={styles.searchFilter}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search restaurants or dishes..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        
        <View style={styles.filterButtons}>
          {['all', 'veg', 'non-veg'].map(type => (
            <TouchableOpacity
              key={type}
              style={[styles.filterBtn, foodTypeFilter === type && styles.filterActive]}
              onPress={() => setFoodTypeFilter(type)}
            >
              <Text style={[styles.filterText, foodTypeFilter === type && styles.filterTextActive]}>
                {type === 'all' ? '🍽️ All' : type === 'veg' ? '🌿 Veg' : '🍗 Non-Veg'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {!selectedRestaurant ? (
        <FlatList
          data={filteredRestaurants}
          renderItem={renderRestaurant}
          keyExtractor={item => item.operatorId}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={() => (
            <Text style={styles.sectionTitle}>Popular Restaurants</Text>
          )}
        />
      ) : (
        <View style={styles.menuView}>
          <View style={styles.menuHeader}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedRestaurant(null)}>
              <Text style={styles.backText}>←</Text>
            </TouchableOpacity>
            <Text style={styles.restaurantTitle} numberOfLines={1}>{selectedRestaurant.restaurantName}</Text>
          </View>
          
          <FlatList
            data={filteredMenu}
            renderItem={({ item }) => <MenuItemCard item={item} />}
            keyExtractor={item => item._id}
            numColumns={2}
            contentContainerStyle={styles.menuList}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDeep },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  welcomeText: { color: COLORS.textMuted, fontSize: 14, fontWeight: '500' },
  title: { fontSize: 28, fontWeight: '900', color: COLORS.textPrimary, letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  cartBtn: {
    marginRight: 16,
    position: 'relative',
    width: 44,
    height: 44,
    backgroundColor: COLORS.bgSurface,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.primary,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: COLORS.bgDeep,
  },
  cartBadgeText: { color: 'white', fontSize: 10, fontWeight: '900' },
  avatar: { 
    width: 44, 
    height: 44, 
    borderRadius: 22, 
    backgroundColor: COLORS.bgSurface, 
    borderWidth: 1, 
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: { color: COLORS.primary, fontWeight: 'bold', fontSize: 18 },
  searchFilter: { paddingHorizontal: 24, marginBottom: 12 },
  searchContainer: {
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  searchInput: {
    color: COLORS.textPrimary,
    padding: 16,
    fontSize: 16,
  },
  filterButtons: { flexDirection: 'row', gap: 12 },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.bgSurface,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterActive: { 
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 13 },
  filterTextActive: { color: 'white' },
  listContent: { paddingHorizontal: 24, paddingBottom: 100 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textPrimary, marginVertical: 20 },
  restaurantCard: {
    height: 200,
    borderRadius: RADIUS.xl,
    marginBottom: 20,
    backgroundColor: COLORS.bgSurface,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  imageOverlay: { flex: 1 },
  restaurantImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  restaurantPlaceholder: { 
    flex: 1, 
    backgroundColor: COLORS.bgCard, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  placeholderText: { fontSize: 60, fontWeight: 'bold', color: 'rgba(255,255,255,0.05)' },
  restaurantGradient: { ...StyleSheet.absoluteFillObject },
  restaurantInfo: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    padding: 20 
  },
  restaurantName: { fontSize: 22, fontWeight: 'bold', color: 'white', marginBottom: 4 },
  restaurantTags: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  menuView: { flex: 1 },
  menuHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.bgSurface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  restaurantTitle: { fontSize: 24, fontWeight: 'bold', color: 'white', flex: 1 },
  menuList: { paddingHorizontal: 16, paddingBottom: 40 },
});

export default BrowseScreen;
