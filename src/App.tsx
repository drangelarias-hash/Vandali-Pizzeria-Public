import React, { useState, useEffect, useMemo } from 'react';
import {
  INITIAL_PIZZAS,
  INITIAL_BEBIDAS,
  INITIAL_SALSAS,
  INITIAL_EXTRAS,
  INITIAL_ADMIN_CONFIG,
} from './data/initialMenu';
import {
  PizzaItem,
  MenuItem,
  AdminConfig,
  CartItem,
  PizzaSize,
  Category,
  OrderRecord,
  UserProfile,
  getPizzaPrice,
} from './types';
import { Header } from './components/Header';
import { PizzaOfTheMonthBanner } from './components/PizzaOfTheMonthBanner';
import { MenuNavigation } from './components/MenuNavigation';
import { PizzaCard } from './components/PizzaCard';
import { MenuItemCard } from './components/MenuItemCard';
import { ItemModal } from './components/ItemModal';
import { HalfAndHalfModal } from './components/HalfAndHalfModal';
import { CartDrawer } from './components/CartDrawer';
import { AdminModal } from './components/AdminModal';
import { AdminPinModal } from './components/AdminPinModal';
import { QRShareModal } from './components/QRShareModal';
import { LoyaltyCardModal } from './components/LoyaltyModal';
import { AuthModal } from './components/AuthModal';
import { Logo } from './components/Logo';
import { formatUSD, formatBs, calculateCartItemPrice } from './utils/currency';
import { fetchLiveExchangeRate } from './utils/exchangeRateApi';
import { hasActiveAdminSession, revokeAdminSession } from './utils/security';
import { syncManager, RemoteSyncState } from './utils/syncManager';
import {
  subscribeToFirestoreOrders,
  saveOrderToFirestore,
  deleteOrderFromFirestore,
  subscribeToFirestoreConfig,
  subscribeToFirestoreMenu,
  seedInitialFirestoreData,
} from './firebase';
import {
  ShoppingBag,
  ArrowRight,
  Sparkles,
  Split,
  MapPin,
  Phone,
  Instagram,
  Award,
  Truck,
  Ticket,
  Bell,
  MessageCircle,
} from 'lucide-react';

export default function App() {
  // 1. Persistent Store State
  const [config, setConfig] = useState<AdminConfig>(() => {
    try {
      const savedMode = localStorage.getItem('vandali_exchange_rate_mode');
      const savedManualRate = localStorage.getItem('vandali_manual_exchange_rate');
      const saved = localStorage.getItem('vandali_admin_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        const resolvedMode: 'auto' | 'manual' =
          savedMode === 'manual' || parsed.exchangeRateMode === 'manual' ? 'manual' : (parsed.exchangeRateMode || 'auto');
        if (resolvedMode !== 'manual') {
          try {
            localStorage.removeItem('vandali_manual_exchange_rate');
            localStorage.setItem('vandali_exchange_rate_mode', 'auto');
          } catch {
            // ignore
          }
        }
        const resolvedRate =
          resolvedMode === 'manual' && savedManualRate
            ? parseFloat(savedManualRate)
            : parsed.exchangeRateBs && parsed.exchangeRateBs > 100
            ? parsed.exchangeRateBs
            : INITIAL_ADMIN_CONFIG.exchangeRateBs;

        const pizzaOfTheMonth =
          !parsed.pizzaOfTheMonth || parsed.pizzaOfTheMonth.pizzaId === 'diablo-ruso'
            ? INITIAL_ADMIN_CONFIG.pizzaOfTheMonth
            : {
                ...INITIAL_ADMIN_CONFIG.pizzaOfTheMonth,
                ...parsed.pizzaOfTheMonth,
              };

        return {
          ...INITIAL_ADMIN_CONFIG,
          ...parsed,
          pizzaOfTheMonth,
          exchangeRateMode: resolvedMode,
          exchangeRateBs: resolvedRate,
          rateSource: resolvedMode === 'manual' ? 'manual' : (parsed.rateSource || 'api_bcv'),
          location: parsed.location && parsed.location !== 'Mérida, Venezuela'
            ? parsed.location
            : INITIAL_ADMIN_CONFIG.location,
          whatsappNumber: parsed.whatsappNumber && parsed.whatsappNumber !== '584126789012'
            ? parsed.whatsappNumber
            : INITIAL_ADMIN_CONFIG.whatsappNumber,
          instagram: parsed.instagram && parsed.instagram !== 'vandalipizzeria'
            ? parsed.instagram
            : INITIAL_ADMIN_CONFIG.instagram,
          pagoMovil: {
            ...INITIAL_ADMIN_CONFIG.pagoMovil,
            ...(parsed.pagoMovil || {}),
            telefono: parsed.pagoMovil?.telefono === '0412-6789012' ? '0424-8954741' : (parsed.pagoMovil?.telefono || '0424-8954741'),
          },
          zelle: { ...INITIAL_ADMIN_CONFIG.zelle, ...(parsed.zelle || {}) },
          binance: { ...INITIAL_ADMIN_CONFIG.binance, ...(parsed.binance || {}) },
          deliveryZones: Array.isArray(parsed.deliveryZones) && parsed.deliveryZones.length > 0
            ? parsed.deliveryZones
            : INITIAL_ADMIN_CONFIG.deliveryZones,
        };
      }
      if (savedMode === 'manual') {
        return {
          ...INITIAL_ADMIN_CONFIG,
          exchangeRateMode: 'manual',
          exchangeRateBs: savedManualRate ? parseFloat(savedManualRate) : INITIAL_ADMIN_CONFIG.exchangeRateBs,
          rateSource: 'manual',
        };
      }
      return INITIAL_ADMIN_CONFIG;
    } catch {
      return INITIAL_ADMIN_CONFIG;
    }
  });

  const [pizzas, setPizzas] = useState<PizzaItem[]>(() => {
    try {
      const saved = localStorage.getItem('vandali_pizzas');
      if (saved) {
        const parsed: PizzaItem[] = JSON.parse(saved);
        let list = parsed.map((p) => {
          if (p.id === 'intocable' || p.name.toUpperCase() === 'INTOCABLE') {
            return { ...p, id: 'intocable-margarita', name: 'INTOCABLE MARGARITA' };
          }
          if (p.id === 'pig-4-pop' || p.name.toUpperCase() === 'PIG 4 POP') {
            return { ...p, id: 'tocipop', name: 'TOCIPOP' };
          }
          if (p.id === 'monte-olivos' || p.name.toUpperCase() === 'MONTE OLIVOS') {
            return { ...p, id: 'monte-olivo', name: 'MONTE OLIVO' };
          }
          return p;
        });

        // Ensure Miss Vandali is present and matches latest recipe
        const missVandaliInitial = INITIAL_PIZZAS.find((p) => p.id === 'miss-vandali');
        const hasMissVandali = list.some(
          (p) => p.id === 'miss-vandali' || p.name.toLowerCase().includes('miss vandali')
        );
        if (!hasMissVandali && missVandaliInitial) {
          list.unshift(missVandaliInitial);
        } else if (hasMissVandali && missVandaliInitial) {
          list = list.map((p) =>
            p.id === 'miss-vandali' || p.name.toLowerCase().includes('miss vandali')
              ? {
                  ...missVandaliInitial,
                  ...p,
                  name: 'MISS VANDALI',
                  description: missVandaliInitial.description,
                  ingredients: missVandaliInitial.ingredients,
                  sauce: missVandaliInitial.sauce,
                  image: missVandaliInitial.image,
                  tagline: missVandaliInitial.tagline,
                }
              : p
          );
        }

        // Ensure Diablo Ruso is present
        const hasDiablo = list.some(
          (p) => p.id === 'diablo-ruso' || p.name.toLowerCase().includes('diablo')
        );
        if (!hasDiablo) {
          const diabloFromInitial = INITIAL_PIZZAS.find((p) => p.id === 'diablo-ruso');
          if (diabloFromInitial) list.push(diabloFromInitial);
        }

        return list;
      }
      return INITIAL_PIZZAS;
    } catch {
      return INITIAL_PIZZAS;
    }
  });

  const [drinks, setDrinks] = useState<MenuItem[]>(() => {
    try {
      const saved = localStorage.getItem('vandali_drinks');
      return saved ? JSON.parse(saved) : INITIAL_BEBIDAS;
    } catch {
      return INITIAL_BEBIDAS;
    }
  });

  const [salsas, setSalsas] = useState<MenuItem[]>(() => {
    try {
      const saved = localStorage.getItem('vandali_salsas');
      return saved ? JSON.parse(saved) : INITIAL_SALSAS;
    } catch {
      return INITIAL_SALSAS;
    }
  });

  const [extras, setExtras] = useState<MenuItem[]>(() => {
    try {
      const saved = localStorage.getItem('vandali_extras');
      return saved ? JSON.parse(saved) : INITIAL_EXTRAS;
    } catch {
      return INITIAL_EXTRAS;
    }
  });

  const [orders, setOrders] = useState<OrderRecord[]>(() => {
    try {
      const saved = localStorage.getItem('vandali_orders');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((o) => o && o.id !== 'MES-9592');
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('vandali_cart');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => ({
            ...item,
            quantity: Number(item.quantity) || 1,
            unitPrice: Number(item.unitPrice) || 0,
            extras: Array.isArray(item.extras) ? item.extras : [],
          }));
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  // 2. User & Loyalty Profile
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('vandali_user_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // 3. UI State
  const [currencyMode, setCurrencyMode] = useState<'both' | 'usd' | 'bs'>('both');
  const [activeCategory, setActiveCategory] = useState<Category>('pizzas');
  const [isUpdatingRate, setIsUpdatingRate] = useState(false);

  // Modals
  const [customizingPizza, setCustomizingPizza] = useState<{
    pizza: PizzaItem;
    initialSize: PizzaSize;
  } | null>(null);
  const [halfAndHalfSelection, setHalfAndHalfSelection] = useState<{
    initialPizzaId?: string;
    initialSize?: PizzaSize;
  } | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAdminPinOpen, setIsAdminPinOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isQROpen, setIsQROpen] = useState(false);
  const [isLoyaltyOpen, setIsLoyaltyOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Ref to always have latest config without stale closures
  const configRef = React.useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Auto-fetch real-time exchange rate on mount (ONLY IF IN AUTO MODE, NEVER IN MANUAL)
  const handleRefreshRate = async (forceAuto = false) => {
    const isManual =
      configRef.current.exchangeRateMode === 'manual' ||
      localStorage.getItem('vandali_exchange_rate_mode') === 'manual';

    // If in manual mode and not explicitly forced by admin, strictly respect manual locked rate
    if (!forceAuto && isManual) {
      console.log('🔒 Exchange rate is locked in manual mode. Automatic refresh bypassed.');
      return;
    }

    if (forceAuto) {
      localStorage.removeItem('vandali_manual_exchange_rate');
      localStorage.setItem('vandali_exchange_rate_mode', 'auto');
    }

    setIsUpdatingRate(true);
    try {
      const rateData = await fetchLiveExchangeRate(forceAuto);
      if (rateData && rateData.bcv > 100) {
        setConfig((prev) => {
          // Double check to not overwrite if switched to manual
          if (!forceAuto && (prev.exchangeRateMode === 'manual' || localStorage.getItem('vandali_exchange_rate_mode') === 'manual')) {
            return prev;
          }
          const updated: AdminConfig = {
            ...prev,
            exchangeRateBs: rateData.bcv,
            exchangeRateMode: 'auto',
            lastRateUpdate: rateData.fechaValor ? `${rateData.lastUpdated} (${rateData.source})` : rateData.lastUpdated,
            rateSource: 'api_bcv',
          };
          if (forceAuto) {
            updated.forceAdminOverride = true;
            localStorage.removeItem('vandali_manual_exchange_rate');
            localStorage.setItem('vandali_exchange_rate_mode', 'auto');
          }
          try {
            localStorage.setItem('vandali_admin_config', JSON.stringify(updated));
          } catch {
            // ignore
          }
          // Synchronize with remote server and clients
          syncManager.updateConfig(updated, forceAuto);
          return updated;
        });
      }
    } catch (err) {
      console.warn('Failed to refresh rate:', err);
    } finally {
      setIsUpdatingRate(false);
    }
  };

  useEffect(() => {
    const isManual =
      configRef.current.exchangeRateMode === 'manual' ||
      localStorage.getItem('vandali_exchange_rate_mode') === 'manual';
    if (!isManual) {
      handleRefreshRate();
    }

    // Auto-refresh rate every 10 minutes and on window refocus
    const interval = setInterval(() => {
      const manual =
        configRef.current.exchangeRateMode === 'manual' ||
        localStorage.getItem('vandali_exchange_rate_mode') === 'manual';
      if (!manual) {
        handleRefreshRate(false);
      }
    }, 10 * 60 * 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const manual =
          configRef.current.exchangeRateMode === 'manual' ||
          localStorage.getItem('vandali_exchange_rate_mode') === 'manual';
        if (!manual) {
          handleRefreshRate(false);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // --- REAL-TIME BIDIRECTIONAL SYNC (FIRESTORE CLOUD DATABASE & SSE) ---
  useEffect(() => {
    // Delete legacy test order MES-9592 from Firestore to guarantee fresh launch state
    deleteOrderFromFirestore('MES-9592').catch(() => {});

    // Ensure Firestore has initial catalog & config so fresh devices immediately sync
    seedInitialFirestoreData({
      config: INITIAL_ADMIN_CONFIG,
      pizzas: INITIAL_PIZZAS,
      drinks: INITIAL_BEBIDAS,
      salsas: INITIAL_SALSAS,
      extras: INITIAL_EXTRAS,
    }).catch(() => {});

    // 1. Subscribe to Cloud Firestore Realtime Orders
    const unsubscribeFirestoreOrders = subscribeToFirestoreOrders((firestoreOrders) => {
      if (Array.isArray(firestoreOrders)) {
        const cleanFirestoreOrders = firestoreOrders.filter((o) => o && o.id !== 'MES-9592');
        if (cleanFirestoreOrders.length !== firestoreOrders.length) {
          deleteOrderFromFirestore('MES-9592').catch(() => {});
        }

        setOrders((prevOrders) => {
          const cleanPrevOrders = prevOrders.filter((o) => o && o.id !== 'MES-9592');

          // If Firestore is empty but we have local orders from before, migrate them to Firestore
          if (cleanFirestoreOrders.length === 0 && cleanPrevOrders.length > 0) {
            cleanPrevOrders.forEach((o) => saveOrderToFirestore(o).catch(() => {}));
            return cleanPrevOrders;
          }

          return cleanFirestoreOrders;
        });
      }
    });

    // 2. Subscribe to Cloud Firestore Config
    const unsubscribeFirestoreConfig = subscribeToFirestoreConfig((firestoreConfig) => {
      if (firestoreConfig) {
        setConfig((prev) => {
          const localMode = localStorage.getItem('vandali_exchange_rate_mode');
          // If locally we are strictly locked in manual mode, and incoming firestoreConfig is auto without forceAdminOverride, preserve manual lock
          if (localMode === 'manual' && firestoreConfig.exchangeRateMode !== 'manual' && !firestoreConfig.forceAdminOverride) {
            return {
              ...prev,
              ...firestoreConfig,
              exchangeRateMode: 'manual',
              exchangeRateBs: prev.exchangeRateBs,
              rateSource: 'manual',
            };
          }
          // If firestoreConfig is explicitly manual, save to local storage
          if (firestoreConfig.exchangeRateMode === 'manual') {
            localStorage.setItem('vandali_exchange_rate_mode', 'manual');
            if (firestoreConfig.exchangeRateBs) {
              localStorage.setItem('vandali_manual_exchange_rate', firestoreConfig.exchangeRateBs.toString());
            }
          } else if (firestoreConfig.exchangeRateMode === 'auto' && firestoreConfig.forceAdminOverride) {
            localStorage.setItem('vandali_exchange_rate_mode', 'auto');
          }

          // If incoming rate is auto and an obsolete relic (< 100) while we already have a verified live rate, preserve our live rate
          if (firestoreConfig.exchangeRateMode === 'auto' && (firestoreConfig.exchangeRateBs || 0) < 100 && prev.exchangeRateBs > 100) {
            return {
              ...prev,
              ...firestoreConfig,
              exchangeRateBs: prev.exchangeRateBs,
              lastRateUpdate: prev.lastRateUpdate,
            };
          }

          return { ...prev, ...firestoreConfig };
        });
      }
    });

    // 3. Subscribe to Cloud Firestore Menu
    const unsubscribeFirestoreMenu = subscribeToFirestoreMenu((firestoreMenu) => {
      if (firestoreMenu) {
        if (Array.isArray(firestoreMenu.pizzas) && firestoreMenu.pizzas.length > 0) {
          const list = [...firestoreMenu.pizzas];
          const hasDiablo = list.some(
            (p) => p.id === 'diablo-ruso' || p.name.toLowerCase().includes('diablo')
          );
          if (!hasDiablo) {
            const diabloFromInitial = INITIAL_PIZZAS.find((p) => p.id === 'diablo-ruso');
            if (diabloFromInitial) list.push(diabloFromInitial);
          }
          setPizzas(list);
        }
        if (Array.isArray(firestoreMenu.drinks) && firestoreMenu.drinks.length > 0) {
          setDrinks(firestoreMenu.drinks);
        }
        if (Array.isArray(firestoreMenu.salsas) && firestoreMenu.salsas.length > 0) {
          setSalsas(firestoreMenu.salsas);
        }
        if (Array.isArray(firestoreMenu.extras) && firestoreMenu.extras.length > 0) {
          setExtras(firestoreMenu.extras);
        }
      }
    });

    // 4. Initial Seed to server if empty
    syncManager.initSeedIfEmpty({
      config,
      pizzas,
      drinks,
      salsas,
      extras,
      orders,
    });

    // 5. Subscribe to live server events (SSE + polling fallback + BroadcastChannel)
    const unsubscribeSync = syncManager.subscribe((remoteState: any, eventType: string) => {
      if (remoteState.config) {
        setConfig((prev) => {
          const localMode = localStorage.getItem('vandali_exchange_rate_mode');
          if (localMode === 'manual' && remoteState.config.exchangeRateMode !== 'manual' && !remoteState.config.forceAdminOverride) {
            return {
              ...prev,
              ...remoteState.config,
              exchangeRateMode: 'manual',
              exchangeRateBs: prev.exchangeRateBs,
              rateSource: 'manual',
            };
          }
          if (remoteState.config.exchangeRateMode === 'auto' && (remoteState.config.exchangeRateBs || 0) < 100 && prev.exchangeRateBs > 100) {
            return {
              ...prev,
              ...remoteState.config,
              exchangeRateBs: prev.exchangeRateBs,
              lastRateUpdate: prev.lastRateUpdate,
            };
          }
          return { ...prev, ...remoteState.config };
        });
      }
      if (Array.isArray(remoteState.pizzas)) {
        setPizzas(remoteState.pizzas);
      }
      if (Array.isArray(remoteState.drinks)) {
        setDrinks(remoteState.drinks);
      }
      if (Array.isArray(remoteState.salsas)) {
        setSalsas(remoteState.salsas);
      }
      if (Array.isArray(remoteState.extras)) {
        setExtras(remoteState.extras);
      }
    });

    return () => {
      unsubscribeFirestoreOrders();
      unsubscribeFirestoreConfig();
      unsubscribeFirestoreMenu();
      unsubscribeSync();
    };
  }, []);

  // Show welcome modal to invite registration/loyalty on very first visit
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('vandali_welcome_prompt_seen');
    if (!hasSeenWelcome && !user) {
      const timer = setTimeout(() => {
        setIsAuthOpen(true);
        localStorage.setItem('vandali_welcome_prompt_seen', 'true');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  // Sync state changes to localStorage
  useEffect(() => {
    localStorage.setItem('vandali_admin_config', JSON.stringify(config));
    if (config.exchangeRateMode) {
      localStorage.setItem('vandali_exchange_rate_mode', config.exchangeRateMode);
    }
    if (config.exchangeRateMode === 'manual' && config.exchangeRateBs) {
      localStorage.setItem('vandali_manual_exchange_rate', config.exchangeRateBs.toString());
    }
  }, [config]);

  useEffect(() => {
    localStorage.setItem('vandali_pizzas', JSON.stringify(pizzas));
  }, [pizzas]);

  useEffect(() => {
    localStorage.setItem('vandali_drinks', JSON.stringify(drinks));
  }, [drinks]);

  useEffect(() => {
    localStorage.setItem('vandali_salsas', JSON.stringify(salsas));
  }, [salsas]);

  useEffect(() => {
    localStorage.setItem('vandali_extras', JSON.stringify(extras));
  }, [extras]);

  useEffect(() => {
    localStorage.setItem('vandali_orders', JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem('vandali_cart', JSON.stringify(cart));
  }, [cart]);

  // Listen to cross-tab storage changes for real-time multi-device sync
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'vandali_orders' && e.newValue) {
        try {
          const updatedOrders: OrderRecord[] = JSON.parse(e.newValue);
          setOrders(updatedOrders);
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    if (user) {
      localStorage.setItem('vandali_user_profile', JSON.stringify(user));
    } else {
      localStorage.removeItem('vandali_user_profile');
    }
  }, [user]);

  // Cart Calculations
  const cartItemCount = useMemo(
    () => cart.reduce((total, it) => total + it.quantity, 0),
    [cart]
  );

  const cartTotalUSD = useMemo(
    () => cart.reduce((total, it) => total + calculateCartItemPrice(it), 0),
    [cart]
  );

  // Handlers
  const handleQuickAddPizza = (pizza: PizzaItem, size: PizzaSize) => {
    const basePrice = getPizzaPrice(pizza, size);
    const existingIndex = cart.findIndex(
      (item) =>
        item.id === pizza.id &&
        item.size === size &&
        !item.stuffedCrust &&
        (!item.extras || item.extras.length === 0) &&
        (!item.removedIngredients || item.removedIngredients.length === 0)
    );

    if (existingIndex > -1) {
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += 1;
      setCart(updatedCart);
    } else {
      const newItem: CartItem = {
        cartId: `${pizza.id}-${size}-${Date.now()}`,
        type: 'pizza',
        id: pizza.id,
        name: pizza.name,
        size,
        unitPrice: basePrice,
        quantity: 1,
        extras: [],
        stuffedCrust: false,
      };
      setCart([...cart, newItem]);
    }
  };

  const handleAddMenuItem = (item: MenuItem) => {
    const existingIndex = cart.findIndex((i) => i.id === item.id);
    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      const newItem: CartItem = {
        cartId: `${item.id}-${Date.now()}`,
        type: 'item',
        id: item.id,
        name: item.name,
        unitPrice: item.price,
        quantity: 1,
        extras: [],
      };
      setCart([...cart, newItem]);
    }
  };

  const handleAddToCartCustom = (customItem: CartItem, accompanyingDrinks?: CartItem[]) => {
    const newItems = [customItem];
    if (accompanyingDrinks && accompanyingDrinks.length > 0) {
      newItems.push(...accompanyingDrinks);
    }
    setCart((prev) => [...prev, ...newItems]);
  };

  const handleUpdateQuantity = (cartId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((it) => {
          if (it.cartId === cartId) {
            const newQty = it.quantity + delta;
            return newQty > 0 ? { ...it, quantity: newQty } : null;
          }
          return it;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const handleRemoveItem = (cartId: string) => {
    setCart((prev) => prev.filter((it) => it.cartId !== cartId));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  // Order Complete Handler (with loyalty ticket updates)
  const handleOrderCompleted = (
    newOrder: OrderRecord,
    earnedTicket: boolean,
    usedDiscount: boolean
  ) => {
    setOrders((prev) => [newOrder, ...prev]);
    setCart([]);

    // Push new order to server immediately (Client -> Master)
    syncManager.createOrder(newOrder);

    // Update user loyalty tickets if logged in
    if (user) {
      let nextTickets = user.loyaltyTickets;
      let nextUnlocked = user.hasUnlockedDiscount;

      if (usedDiscount) {
        // Reset tickets once 30% discount is redeemed
        nextTickets = 0;
        nextUnlocked = false;
      }

      if (earnedTicket) {
        nextTickets = Math.min(10, nextTickets + 1);
        if (nextTickets >= 10) {
          nextUnlocked = true;
        }
      }

      const updatedUser: UserProfile = {
        ...user,
        loyaltyTickets: nextTickets,
        hasUnlockedDiscount: nextUnlocked,
        totalSpentUSD: user.totalSpentUSD + newOrder.totalUSD,
        completedOrdersCount: user.completedOrdersCount + 1,
      };

      setUser(updatedUser);
      try {
        localStorage.setItem('vandali_user_profile', JSON.stringify(updatedUser));
        if (updatedUser.email) {
          localStorage.setItem(
            `vandali_user_${updatedUser.email.toLowerCase()}`,
            JSON.stringify(updatedUser)
          );
        }
      } catch {
        // ignore
      }
    }
  };

  const handleAddLocalOrder = (newLocalOrder: OrderRecord) => {
    setOrders((prev) => [newLocalOrder, ...prev]);
    syncManager.createOrder(newLocalOrder);
  };

  const handleDeleteOrder = (orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    syncManager.deleteOrder(orderId);
  };

  const handleUpdateOrder = (orderId: string, updatedOrderData: Partial<OrderRecord>) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, ...updatedOrderData } : o))
    );
    syncManager.updateOrder(orderId, updatedOrderData);
  };

  const handleUpdateOrderStatus = (orderId: string, status: OrderRecord['status']) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status } : o))
    );

    // Broadcast status change immediately to all client screens
    syncManager.updateOrder(orderId, { status });
  };

  // Menu Items (Direct, clean display without search overhead)
  const filteredPizzas = pizzas;
  const filteredDrinks = drinks;
  const filteredSalsas = salsas;
  const filteredExtras = extras;

  const allMenuItemsForAdmin = useMemo(() => {
    return [...drinks, ...salsas, ...extras];
  }, [drinks, salsas, extras]);

  const handleOpenAdminTrigger = () => {
    if (hasActiveAdminSession()) {
      setIsAdminOpen(true);
    } else {
      setIsAdminPinOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F7] flex flex-col selection:bg-[#B71C1C] selection:text-white">
      {/* 1. Header with live status, API rate sync, and quick actions */}
      <Header
        config={config}
        user={user}
        isUpdatingRate={isUpdatingRate}
        onRefreshRate={handleRefreshRate}
        cartCount={cartItemCount}
        cartTotalUSD={cartTotalUSD}
        currencyMode={currencyMode}
        setCurrencyMode={setCurrencyMode}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenAdmin={handleOpenAdminTrigger}
        onOpenQR={() => setIsQROpen(true)}
        onOpenLoyalty={() => setIsLoyaltyOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      {/* 2. Sticky Category Navigation (Clean & Simple) */}
      <MenuNavigation
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        pizzaCount={pizzas.filter((p) => p.isAvailable !== false).length}
      />

      {/* 3. Main Menu Display Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 pb-28">
        {/* CATEGORY: PIZZAS */}
        {activeCategory === 'pizzas' && (
          <section className="space-y-6">
            {/* Pizza del Mes (MISS VANDALI) Banner (oculto si la pizza está marcada como no disponible) */}
            {(() => {
              const potmPizza = pizzas.find(
                (p) =>
                  p.id === (config.pizzaOfTheMonth?.pizzaId || 'miss-vandali') ||
                  p.name.toLowerCase().includes('miss vandali') ||
                  p.id === 'miss-vandali'
              );
              if (potmPizza && potmPizza.isAvailable === false) {
                return null;
              }
              return (
                <PizzaOfTheMonthBanner
                  pizza={potmPizza || null}
                  config={config}
                  onOrderPizza={(p) => {
                    setActiveCategory('pizzas');
                    setCustomizingPizza({ pizza: p, initialSize: 'mediana' });
                  }}
                />
              );
            })()}

            <div className="border-b border-white/10 pb-3">
              <h2
                className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 font-serif"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                Catálogo de Pizzas Artesanales
              </h2>
            </div>

            {pizzas.filter((pizza) => pizza.isAvailable !== false).length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                {pizzas
                  .filter((pizza) => pizza.isAvailable !== false)
                  .map((pizza) => (
                    <PizzaCard
                      key={pizza.id}
                      pizza={pizza}
                      exchangeRate={config.exchangeRateBs}
                      currencyMode={currencyMode}
                      onOrder={(p, size) =>
                        setCustomizingPizza({ pizza: p, initialSize: size })
                      }
                      onOrderHalf={(p, size) =>
                        setHalfAndHalfSelection({ initialPizzaId: p.id, initialSize: size })
                      }
                    />
                  ))}
              </div>
            ) : (
              <div className="text-center py-12 px-4 rounded-2xl bg-[#0F0F0F] border border-white/5 space-y-2">
                <p className="text-sm font-bold text-zinc-300">
                  No hay pizzas disponibles temporalmente para pedidos en línea.
                </p>
                <p className="text-xs text-zinc-500">
                  Por favor contáctanos por WhatsApp para consultar disponibilidad en cocina.
                </p>
              </div>
            )}
          </section>
        )}

        {/* CATEGORY: BEBIDAS */}
        {activeCategory === 'bebidas' && (
          <section className="space-y-6">
            <div className="border-b border-white/10 pb-3">
              <h2
                className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 font-serif"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                Bebidas Frías & Cervezas
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400">
                Refrescos, té helado, agua mineral y cervezas bien frías para acompañar
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {filteredDrinks.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  exchangeRate={config.exchangeRateBs}
                  currencyMode={currencyMode}
                  onAdd={handleAddMenuItem}
                />
              ))}
            </div>
          </section>
        )}

        {/* CATEGORY: EXTRAS */}
        {activeCategory === 'extras' && (
          <section className="space-y-6">
            <div className="border-b border-white/10 pb-3">
              <h2
                className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2 font-serif"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                Extras & Toppings Artesanales
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400">
                Toppings adicionales de primera calidad para acompañar tus pizzas
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {filteredExtras.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  exchangeRate={config.exchangeRateBs}
                  currencyMode={currencyMode}
                  onAdd={handleAddMenuItem}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* 5. Mobile Floating Cart Bar */}
      {cartItemCount > 0 && !isCartOpen && (
        <div className="fixed bottom-3 inset-x-3 sm:inset-x-auto sm:right-6 sm:w-96 z-40 animate-in slide-in-from-bottom-5 duration-300">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#B71C1C] hover:bg-[#c62828] text-white shadow-[0_8px_30px_rgba(183,28,28,0.5)] border border-[#ff4d4d]/30 flex items-center justify-between gap-3 active:scale-95 transition-all"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white text-[#B71C1C] font-black flex items-center justify-center text-xs shadow-sm">
                {cartItemCount}
              </div>
              <div className="text-left">
                <div className="font-extrabold text-sm leading-tight">Ver Orden</div>
                <div className="text-[11px] text-red-200">
                  {cart.length} {cart.length === 1 ? 'ítem' : 'ítems'} agregado(s)
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="font-mono font-extrabold text-base leading-none">
                  {formatUSD(cartTotalUSD)}
                </div>
                <div className="font-mono text-[10px] text-amber-200">
                  {formatBs(cartTotalUSD, config.exchangeRateBs)}
                </div>
              </div>
              <ArrowRight className="w-5 h-5" />
            </div>
          </button>
        </div>
      )}

      {/* WhatsApp Help CTA Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6 my-2">
        <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-[#121216] via-[#1A1A22] to-[#121216] border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3.5 text-center sm:text-left">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm sm:text-base font-bold text-white font-serif">
                ¿Tienes problemas para ordenar?
              </h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Escríbenos directamente a nuestro WhatsApp y con gusto tomamos tu pedido al instante.
              </p>
            </div>
          </div>

          <a
            href={`https://wa.me/${(config.whatsappNumber || '584248954741').replace(/\D/g, '')}?text=${encodeURIComponent(
              '¡Hola Vandali Pizzería! Necesito ayuda para realizar mi pedido por favor.'
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(16,185,129,0.3)] transition-all shrink-0"
          >
            <MessageCircle className="w-4 h-4 fill-white" />
            <span>Escribir por WhatsApp</span>
          </a>
        </div>
      </section>

      {/* 6. Footer */}
      <footer className="bg-[#050505] border-t border-white/10 pt-8 pb-12 px-4 sm:px-6 text-zinc-400 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start text-center md:text-left gap-2">
            <Logo size="md" variant="red" />
            <p className="text-zinc-400 max-w-sm">
              Pizzería Artesanal • Pizza estilo napolitano con masa de fermentación lenta de al menos 48 horas • Horno a 450°C • Mérida, Venezuela.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-zinc-300">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#B71C1C]" />
              <span>{config.location || 'Av. 2 Lora, entre calles 27 y 28, Mérida, Venezuela'}</span>
            </div>
            <a
              href={`https://wa.me/${(config.whatsappNumber || '584248954741').replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <Phone className="w-4 h-4 text-[#D4AF37]" />
              <span>{config.phoneFormatted || '0424-8954741'}</span>
            </a>
            <a
              href={`https://instagram.com/${config.instagram || 'vandali.pizzeria'}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-white transition-colors"
            >
              <Instagram className="w-4 h-4 text-pink-500" />
              <span>@{config.instagram || 'vandali.pizzeria'}</span>
            </a>
          </div>

          <div className="text-center md:text-right text-zinc-400 text-[11px]">
            <div>Tasa activa en vivo: 1 USD = Bs. {config.exchangeRateBs.toFixed(2)}</div>
            <div className="mt-1 text-zinc-400">
              © {new Date().getFullYear()} Vandali Pizzería Artesanal. Todos los derechos reservados.
            </div>
          </div>
        </div>
      </footer>

      {/* 7. Modals */}
      {customizingPizza && (
        <ItemModal
          key={`${customizingPizza.pizza.id}-${customizingPizza.initialSize}`}
          pizza={customizingPizza.pizza}
          initialSize={customizingPizza.initialSize}
          drinks={drinks}
          extras={extras}
          exchangeRate={config.exchangeRateBs}
          currencyMode={currencyMode}
          onClose={() => setCustomizingPizza(null)}
          onAddToCart={handleAddToCartCustom}
        />
      )}

      {halfAndHalfSelection && (
        <HalfAndHalfModal
          key={`${halfAndHalfSelection.initialPizzaId || 'none'}-${halfAndHalfSelection.initialSize || 'familiar'}`}
          pizzas={pizzas.filter(
            (p) =>
              p.isAvailable !== false &&
              p.id !== 'miss-vandali' &&
              !p.name.toLowerCase().includes('miss vandali') &&
              p.id !== 'diablo-ruso' &&
              !p.name.toLowerCase().includes('diablo') &&
              !p.tagline?.toLowerCase().includes('mes')
          )}
          initialPizzaId={halfAndHalfSelection.initialPizzaId}
          initialSize={halfAndHalfSelection.initialSize || 'familiar'}
          extras={extras}
          exchangeRate={config.exchangeRateBs}
          currencyMode={currencyMode}
          onClose={() => setHalfAndHalfSelection(null)}
          onAddToCart={handleAddToCartCustom}
        />
      )}

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cart}
        config={config}
        user={user}
        currencyMode={currencyMode}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        onOrderCompleted={handleOrderCompleted}
        onOpenLoyalty={() => setIsLoyaltyOpen(true)}
      />

      {/* Admin PIN Gatekeeper Modal */}
      <AdminPinModal
        isOpen={isAdminPinOpen}
        onClose={() => setIsAdminPinOpen(false)}
        onSuccess={() => {
          setIsAdminPinOpen(false);
          setIsAdminOpen(true);
        }}
      />

      {/* Admin Module */}
      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        config={config}
        onUpdateConfig={(newConfig) => {
          if (newConfig.exchangeRateMode === 'manual') {
            localStorage.setItem('vandali_exchange_rate_mode', 'manual');
            if (newConfig.exchangeRateBs) {
              localStorage.setItem('vandali_manual_exchange_rate', newConfig.exchangeRateBs.toString());
            }
          } else if (newConfig.exchangeRateMode === 'auto') {
            localStorage.setItem('vandali_exchange_rate_mode', 'auto');
          }
          setConfig(newConfig);
          syncManager.updateConfig(newConfig, true);
        }}
        pizzas={pizzas}
        onUpdatePizzas={(newPizzas) => {
          setPizzas(newPizzas);
          syncManager.updateMenu({ pizzas: newPizzas });
        }}
        drinks={drinks}
        onUpdateDrinks={(newDrinks) => {
          setDrinks(newDrinks);
          syncManager.updateMenu({ drinks: newDrinks });
        }}
        salsas={salsas}
        onUpdateSalsas={(newSalsas) => {
          setSalsas(newSalsas);
          syncManager.updateMenu({ salsas: newSalsas });
        }}
        extras={extras}
        onUpdateExtras={(newExtras) => {
          setExtras(newExtras);
          syncManager.updateMenu({ extras: newExtras });
        }}
        orders={orders}
        onUpdateOrderStatus={handleUpdateOrderStatus}
        onUpdateOrder={handleUpdateOrder}
        onDeleteOrder={handleDeleteOrder}
        onAddLocalOrder={handleAddLocalOrder}
        onRefreshLiveRate={handleRefreshRate}
        isUpdatingRate={isUpdatingRate}
        onLogoutAdmin={() => {
          revokeAdminSession();
          setIsAdminOpen(false);
        }}
      />

      <QRShareModal isOpen={isQROpen} onClose={() => setIsQROpen(false)} />

      <LoyaltyCardModal
        isOpen={isLoyaltyOpen}
        onClose={() => setIsLoyaltyOpen(false)}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={setUser}
        currentUser={user}
        onLogout={() => setUser(null)}
      />
    </div>
  );
}
