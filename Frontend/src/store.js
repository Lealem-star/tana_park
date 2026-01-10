import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // Choose your desired storage medium
import rootReducer from './reducers/rootReducer';


// Create the Redux Persist configuration
const persistConfig = {
  key: 'root',
  storage,
};

// Wrap your root reducer with the persistReducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Create the Redux store
const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['FLUSH', 'REHYDRATE', 'PAUSE', 'PERSIST', 'PURGE', 'REGISTER'],
        ignoredActionPaths: ['payload.register', 'payload.rehydrate', 'register', 'rehydrate'],
      },
    }),
});

// Create the Redux Persist store persistor
const persistor = persistStore(store);

export { store, persistor };