import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getBookmarks, deleteBookmark, addBookmark, updateBookmark } from '../services/firebaseConfig';
import { 
  Trash2, Check, X, Globe, Bookmark, Grid, List, Search, 
  SortAsc, PlusCircle, Calendar, ExternalLink, Tag, Copy, Edit,
  Star, StarOff, Loader, Tags, Filter, AlertCircle
} from 'lucide-react';
import moduleStyles from './DashboardModule.module.css';
import styles from './FullPageBookmarks.module.css';

const BookmarkCard = ({ bookmark, onDelete, onUpdate, viewMode }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const createdDate = bookmark.createdAt?.toDate ? 
    new Date(bookmark.createdAt.toDate()) : 
    bookmark.createdAt instanceof Date ? 
    bookmark.createdAt : new Date();

  const handleDeleteClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsConfirmingDelete(true);
  };

  const handleConfirmDelete = () => {
    onDelete(bookmark.id);
    setIsConfirmingDelete(false);
  };

  const handleCancelDelete = () => {
    setIsConfirmingDelete(false);
  };
  
  const toggleFavorite = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onUpdate(bookmark.id, { favorite: !bookmark.favorite });
  };
  
  const copyToClipboard = (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(bookmark.url)
      .then(() => {
        // Show toast instead of alert
        const toast = document.createElement('div');
        toast.className = styles.toast;
        toast.innerHTML = '<span>URL copied to clipboard!</span>';
        document.body.appendChild(toast);
        
        setTimeout(() => {
          toast.classList.add(styles.toastHide);
          setTimeout(() => document.body.removeChild(toast), 300);
        }, 2000);
      })
      .catch(err => {
        console.error('Could not copy URL: ', err);
      });
  };
  
  if (viewMode === 'list') {
    return (
      <div className={`${styles.bookmarkListItem} ${bookmark.favorite ? styles.bookmarkFavorite : ''}`}>
        <div className={styles.bookmarkListContent}>
          {imageError ? (
            <div className={styles.bookmarkListImageFallback}>
              <Globe size={20} />
            </div>
          ) : (
            <img 
              src={bookmark.image} 
              alt={bookmark.title} 
              className={styles.bookmarkListImage} 
              onError={() => setImageError(true)}
            />
          )}
          
          <div className={styles.bookmarkListInfo}>
            <a href={bookmark.url} target="_blank" rel="noopener noreferrer" className={styles.bookmarkListTitle}>
              {bookmark.title}
              {bookmark.favorite && <span className={styles.favoriteIndicator}><Star size={14} /></span>}
            </a>
            <div className={styles.bookmarkListUrl}>{bookmark.url}</div>
            <div className={styles.bookmarkListMeta}>
              <span className={styles.bookmarkListDate}><Calendar size={12} /> {createdDate.toLocaleDateString()}</span>
              {bookmark.tags && bookmark.tags.length > 0 && (
                <div className={styles.bookmarkListTags}>
                  {bookmark.tags.map(tag => (
                    <span key={tag} className={styles.bookmarkListTag}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className={styles.bookmarkListActions}>
          <a href={bookmark.url} target="_blank" rel="noopener noreferrer" className={styles.bookmarkListActionButton}>
            <ExternalLink size={16} />
          </a>
          <button 
            className={styles.bookmarkListActionButton}
            onClick={copyToClipboard}
            title="Copy URL"
          >
            <Copy size={16} />
          </button>
          <button 
            className={`${styles.bookmarkListActionButton} ${bookmark.favorite ? styles.favoriteActive : ''}`}
            onClick={toggleFavorite}
            title={bookmark.favorite ? "Remove from favorites" : "Add to favorites"}
          >
            {bookmark.favorite ? <Star size={16} /> : <StarOff size={16} />}
          </button>
          <button
            className={styles.bookmarkListActionButtonDelete}
            onClick={handleDeleteClick}
            title="Delete bookmark"
          >
            <Trash2 size={16} />
          </button>
        </div>
        
        {isConfirmingDelete && (
          <div className={moduleStyles.deleteConfirmationOverlay}>
            <div className={moduleStyles.deleteConfirmation}>
              <span>Confirm delete?</span>
              <button
                className={moduleStyles.actionButton}
                style={{ backgroundColor: '#4ade80', color: 'white', padding: '0.25rem 0.5rem', margin: '0 0.25rem' }}
                onClick={handleConfirmDelete}
                title="Yes, delete bookmark"
              >
                <Check size={14} />
              </button>
              <button
                className={moduleStyles.actionButton}
                style={{ backgroundColor: '#f87171', color: 'white', padding: '0.25rem 0.5rem', margin: '0 0.25rem' }}
                onClick={handleCancelDelete}
                title="No, cancel"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      className={`${styles.bookmarkCard} ${bookmark.favorite ? styles.bookmarkFavorite : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        if (!isConfirmingDelete) {
          setIsConfirmingDelete(false);
        }
      }}
    >
      <a href={bookmark.url} target="_blank" rel="noopener noreferrer" className={styles.bookmarkLink}>
        {imageError ? (
          <div className={styles.bookmarkImageFallback}>
            <Globe size={40} />
            <span className={styles.bookmarkInitial}>
              {(bookmark.title || bookmark.url || 'B').charAt(0).toUpperCase()}
            </span>
          </div>
        ) : (
          <img 
            src={bookmark.image} 
            alt={bookmark.title} 
            className={styles.bookmarkImage} 
            onError={() => setImageError(true)}
          />
        )}
        
        <div className={styles.bookmarkCardContent}>
          <h3 className={styles.bookmarkTitle}>
            {bookmark.title}
            {bookmark.favorite && <span className={styles.favoriteIndicator}><Star size={14} /></span>}
          </h3>
          <div className={styles.bookmarkUrl}>{bookmark.url}</div>
          
          <div className={styles.bookmarkMeta}>
            <span className={styles.bookmarkDate}>
              <Calendar size={12} /> {createdDate.toLocaleDateString()}
            </span>
            
            {bookmark.tags && bookmark.tags.length > 0 && (
              <div className={styles.bookmarkTags}>
                {bookmark.tags.map(tag => (
                  <span key={tag} className={styles.bookmarkTag}>{tag}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </a>
      
      <div className={styles.bookmarkActions}>
        <button 
          className={styles.bookmarkActionButton}
          onClick={copyToClipboard}
          title="Copy URL"
        >
          <Copy size={16} />
        </button>
        <button 
          className={`${styles.bookmarkActionButton} ${bookmark.favorite ? styles.favoriteActive : ''}`}
          onClick={toggleFavorite}
          title={bookmark.favorite ? "Remove from favorites" : "Add to favorites"}
        >
          {bookmark.favorite ? <Star size={16} /> : <StarOff size={16} />}
        </button>
        <button
          className={`${moduleStyles.iconButton} ${moduleStyles.deleteButton}`}
          onClick={handleDeleteClick}
          title="Delete bookmark"
        >
          <Trash2 size={16} />
        </button>
      </div>
      
      {isConfirmingDelete && (
        <div className={moduleStyles.deleteConfirmationOverlay}>
          <div className={moduleStyles.deleteConfirmation}>
            <span>Confirm delete?</span>
            <button
              className={moduleStyles.actionButton}
              style={{ backgroundColor: '#4ade80', color: 'white', padding: '0.25rem 0.5rem', margin: '0 0.25rem' }}
              onClick={handleConfirmDelete}
              title="Yes, delete bookmark"
            >
              <Check size={14} />
            </button>
            <button
              className={moduleStyles.actionButton}
              style={{ backgroundColor: '#f87171', color: 'white', padding: '0.25rem 0.5rem', margin: '0 0.25rem' }}
              onClick={handleCancelDelete}
              title="No, cancel"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const FullPageBookmarks = ({ user }) => {
  const { projectId } = useParams();
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'grid' or 'list'
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'oldest', 'title', 'favorite'
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBookmark, setNewBookmark] = useState({ url: '', title: '', tags: '' });
  const [error, setError] = useState(null);
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const urlInputRef = useRef(null);

  useEffect(() => {
    fetchBookmarks();
  }, [user, projectId]);
  
  // Extract all unique tags from bookmarks
  useEffect(() => {
    if (bookmarks.length > 0) {
      const allTags = bookmarks.reduce((tags, bookmark) => {
        if (bookmark.tags && Array.isArray(bookmark.tags)) {
          return [...tags, ...bookmark.tags];
        }
        return tags;
      }, []);
      
      // Get unique tags
      const uniqueTags = [...new Set(allTags)].sort();
      setAvailableTags(uniqueTags);
    }
  }, [bookmarks]);

  const fetchBookmarks = async () => {
    if (!user || !projectId) return;
    
    try {
      const fetchedBookmarks = await getBookmarks(user.uid, projectId);
      setBookmarks(fetchedBookmarks);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching bookmarks:", error);
      setLoading(false);
      setError("Failed to fetch bookmarks");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteBookmark(id);
      setBookmarks(bookmarks.filter(bookmark => bookmark.id !== id));
    } catch (error) {
      console.error("Error deleting bookmark:", error);
      setError("Failed to delete bookmark");
    }
  };
  
  const handleUpdateBookmark = async (id, updates) => {
    try {
      await updateBookmark(id, updates);
      setBookmarks(bookmarks.map(bookmark => 
        bookmark.id === id ? { ...bookmark, ...updates } : bookmark
      ));
    } catch (error) {
      console.error("Error updating bookmark:", error);
      setError("Failed to update bookmark");
    }
  };
  
  const fetchPageMetadata = async () => {
    if (!newBookmark.url.trim()) return;
    
    setIsMetadataLoading(true);
    try {
      // Simple URL validation
      let url = newBookmark.url.trim();
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }
      
      // Try to fetch the page and extract title
      const corsProxy = 'https://api.allorigins.win/get?url=';
      const encodedUrl = encodeURIComponent(url);
      const response = await fetch(`${corsProxy}${encodedUrl}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.contents) {
          // Create a temporary DOM element to parse the HTML
          const doc = new DOMParser().parseFromString(data.contents, 'text/html');
          
          // Extract title
          const title = doc.querySelector('title')?.textContent || '';
          
          // Extract favicon (basic approach)
          let favicon = null;
          const faviconLink = doc.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
          if (faviconLink) {
            let faviconUrl = faviconLink.getAttribute('href');
            // Handle relative URLs
            if (faviconUrl && !faviconUrl.startsWith('http')) {
              const urlObj = new URL(url);
              if (faviconUrl.startsWith('/')) {
                faviconUrl = `${urlObj.protocol}//${urlObj.host}${faviconUrl}`;
              } else {
                faviconUrl = `${urlObj.protocol}//${urlObj.host}/${faviconUrl}`;
              }
            }
            favicon = faviconUrl;
          } else {
            // Default to standard favicon location
            const urlObj = new URL(url);
            favicon = `${urlObj.protocol}//${urlObj.host}/favicon.ico`;
          }
          
          setNewBookmark(prev => ({
            ...prev,
            url: url,
            title: prev.title || title,
            image: favicon
          }));
        }
      }
    } catch (error) {
      console.error("Error fetching page metadata:", error);
      // Continue without metadata
    } finally {
      setIsMetadataLoading(false);
    }
  };
  
  const handleAddBookmark = async (e) => {
    e.preventDefault();
    
    if (!newBookmark.url.trim()) {
      setError("URL is required");
      return;
    }
    
    try {
      // Process tags if provided
      let tags = [];
      if (newBookmark.tags.trim()) {
        tags = newBookmark.tags.split(',').map(tag => tag.trim());
      }
      
      // Prepare URL (ensure it has a protocol)
      let url = newBookmark.url.trim();
      if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
      }
      
      // Create bookmark
      const bookmarkData = {
        url,
        title: newBookmark.title.trim() || url,
        tags,
        image: newBookmark.image || null,
        favorite: false,
        createdAt: new Date()
      };
      
      const addedBookmark = await addBookmark(bookmarkData, user.uid, projectId);
      setBookmarks([addedBookmark, ...bookmarks]);
      
      // Reset form
      setNewBookmark({ url: '', title: '', tags: '' });
      setShowAddForm(false);
      setError(null);
    } catch (error) {
      console.error("Error adding bookmark:", error);
      setError("Failed to add bookmark");
    }
  };
  
  const toggleViewMode = () => {
    setViewMode(viewMode === 'grid' ? 'list' : 'grid');
  };
  
  const handleSortChange = (e) => {
    setSortBy(e.target.value);
  };
  
  const toggleTagSelection = (tag) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag) 
        : [...prev, tag]
    );
  };
  
  const filteredAndSortedBookmarks = () => {
    // First filter by search term and favorites
    let filtered = bookmarks;
    
    // Filter by favorites if enabled
    if (filterFavorites) {
      filtered = filtered.filter(bookmark => bookmark.favorite);
    }
    
    // Filter by selected tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter(bookmark => 
        selectedTags.every(selectedTag => 
          bookmark.tags && bookmark.tags.includes(selectedTag)
        )
      );
    }
    
    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(bookmark => 
        bookmark.title?.toLowerCase().includes(term) || 
        bookmark.url?.toLowerCase().includes(term) ||
        bookmark.tags?.some(tag => tag.toLowerCase().includes(term))
      );
    }
    
    // Then sort
    return filtered.sort((a, b) => {
      // Always sort favorites to top if sorting by favorites
      if (sortBy === 'favorite') {
        if (a.favorite && !b.favorite) return -1;
        if (!a.favorite && b.favorite) return 1;
      }
      
      const dateA = a.createdAt?.toDate ? new Date(a.createdAt.toDate()) : new Date();
      const dateB = b.createdAt?.toDate ? new Date(b.createdAt.toDate()) : new Date();
      
      switch (sortBy) {
        case 'newest':
          return dateB - dateA;
        case 'oldest':
          return dateA - dateB;
        case 'title':
          return (a.title || '').localeCompare(b.title || '');
        case 'favorite':
          // If both have same favorite status, sort by date
          return dateB - dateA;
        default:
          return 0;
      }
    });
  };
  
  const getLayoutClass = () => {
    return viewMode === 'grid' ? styles.bookmarkGrid : styles.bookmarkList;
  };
  
  const resetFilters = () => {
    setSearchTerm('');
    setSelectedTags([]);
    setFilterFavorites(false);
    setSortBy('newest');
  };

  if (loading) {
    return <div className={moduleStyles.loading}>Loading bookmarks...</div>;
  }

  return (
    <div className="container mt-4">
      <div className={moduleStyles.container}>
        <div className={moduleStyles.header}>
          <h2 className={moduleStyles.title}>
            <Bookmark size={20} />
            <span>All Bookmarks</span>
          </h2>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {(selectedTags.length > 0 || filterFavorites || searchTerm) && (
              <button 
                className={`${moduleStyles.actionButton} ${moduleStyles.secondaryButton}`}
                onClick={resetFilters}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                title="Clear all filters"
              >
                <X size={16} />
                Clear filters
              </button>
            )}
            <button 
              className={`${moduleStyles.actionButton} ${moduleStyles.primaryButton}`}
              onClick={() => {
                setShowAddForm(!showAddForm);
                if (!showAddForm) {
                  // Focus URL input when form opens
                  setTimeout(() => urlInputRef.current?.focus(), 100);
                }
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <PlusCircle size={16} />
              {showAddForm ? 'Cancel' : 'Add Bookmark'}
            </button>
          </div>
        </div>
        
        {showAddForm && (
          <div className={styles.addBookmarkForm}>
            <form onSubmit={handleAddBookmark}>
              <div className={styles.formRow}>
                <div className={styles.formGroup} style={{ flex: 2 }}>
                  <label htmlFor="bookmarkUrl" className={styles.formLabel}>URL *</label>
                  <div className={styles.inputWithButton}>
                    <input
                      id="bookmarkUrl"
                      type="text"
                      className={styles.formInput}
                      placeholder="https://example.com"
                      value={newBookmark.url}
                      onChange={(e) => setNewBookmark({...newBookmark, url: e.target.value})}
                      ref={urlInputRef}
                      required
                    />
                    <button 
                      type="button" 
                      className={styles.fetchButton}
                      onClick={fetchPageMetadata}
                      disabled={isMetadataLoading || !newBookmark.url.trim()}
                      title="Fetch page details"
                    >
                      {isMetadataLoading ? <Loader size={16} className={styles.loadingIcon} /> : 'Fetch'}
                    </button>
                  </div>
                </div>
                
                <div className={styles.formGroup}>
                  <label htmlFor="bookmarkTitle" className={styles.formLabel}>Title</label>
                  <input
                    id="bookmarkTitle"
                    type="text"
                    className={styles.formInput}
                    placeholder="Page Title"
                    value={newBookmark.title}
                    onChange={(e) => setNewBookmark({...newBookmark, title: e.target.value})}
                  />
                </div>
              </div>
              
              <div className={styles.formRow}>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label htmlFor="bookmarkTags" className={styles.formLabel}>
                    <Tag size={14} /> Tags (comma separated)
                  </label>
                  <input
                    id="bookmarkTags"
                    type="text"
                    className={styles.formInput}
                    placeholder="work, reference, tutorial"
                    value={newBookmark.tags}
                    onChange={(e) => setNewBookmark({...newBookmark, tags: e.target.value})}
                  />
                  {availableTags.length > 0 && (
                    <div className={styles.existingTags}>
                      <span className={styles.existingTagsLabel}>Existing tags:</span>
                      <div className={styles.tagsList}>
                        {availableTags.map(tag => (
                          <span 
                            key={tag} 
                            className={styles.existingTag}
                            onClick={() => {
                              const currentTags = newBookmark.tags.split(',').map(t => t.trim()).filter(t => t);
                              if (!currentTags.includes(tag)) {
                                const updatedTags = [...currentTags, tag].join(', ');
                                setNewBookmark({...newBookmark, tags: updatedTags});
                              }
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className={styles.formGroup} style={{ alignSelf: 'flex-end' }}>
                  <button 
                    type="submit" 
                    className={`${moduleStyles.actionButton} ${moduleStyles.primaryButton}`}
                    style={{ marginBottom: '1px' }}
                    disabled={isMetadataLoading}
                  >
                    Add Bookmark
                  </button>
                </div>
              </div>
            </form>
            
            {error && <div className={moduleStyles.error}>{error}</div>}
          </div>
        )}

        <div className={styles.filterSection}>
          {/* Main controls bar with search and sort */}
          <div className={styles.controlsBar}>
            <div className={styles.searchBox}>
              <Search size={16} />
              <input
                type="text"
                placeholder="Search bookmarks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
            </div>
            
            <div className={styles.controlsRight}>
              <button
                className={`${styles.filterButton} ${filterFavorites ? styles.filterActive : ''}`}
                onClick={() => setFilterFavorites(!filterFavorites)}
                title={filterFavorites ? "Show all bookmarks" : "Show only favorites"}
              >
                <Star size={16} />
              </button>
              
              <select 
                value={sortBy}
                onChange={handleSortChange}
                className={styles.sortSelect}
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="title">Title (A-Z)</option>
                <option value="favorite">Favorites First</option>
              </select>
              
              <button 
                className={styles.viewToggleButton}
                onClick={toggleViewMode}
                title={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
              >
                {viewMode === 'grid' ? <List size={18} /> : <Grid size={18} />}
              </button>
            </div>
          </div>
          
          {/* Tag filtering */}
          {availableTags.length > 0 && (
            <div className={styles.tagFilters}>
              <div className={styles.tagFiltersHeader}>
                <Tags size={14} />
                <span>Filter by tags:</span>
              </div>
              <div className={styles.tagFiltersList}>
                {availableTags.map(tag => (
                  <button
                    key={tag}
                    className={`${styles.tagFilterButton} ${selectedTags.includes(tag) ? styles.tagFilterActive : ''}`}
                    onClick={() => toggleTagSelection(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Results count */}
        <div className={styles.resultsCount}>
          {filteredAndSortedBookmarks().length} bookmark{filteredAndSortedBookmarks().length !== 1 ? 's' : ''}
          {(selectedTags.length > 0 || filterFavorites || searchTerm) && ' (filtered)'}
        </div>
        
        {filteredAndSortedBookmarks().length > 0 ? (
          <div className={getLayoutClass()}>
            {filteredAndSortedBookmarks().map((bookmark) => (
              <BookmarkCard
                key={bookmark.id}
                bookmark={bookmark}
                onDelete={handleDelete}
                onUpdate={handleUpdateBookmark}
                viewMode={viewMode}
              />
            ))}
          </div>
        ) : (
          <div className={moduleStyles.emptyState}>
            {searchTerm || selectedTags.length > 0 || filterFavorites ? (
              <div className={styles.noResultsMessage}>
                <AlertCircle size={24} />
                <p>No bookmarks match your search or filters.</p>
                <button 
                  className={`${moduleStyles.actionButton} ${moduleStyles.secondaryButton}`}
                  onClick={resetFilters}
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className={styles.emptyBookmarks}>
                <Bookmark size={32} />
                <p>No bookmarks added yet.</p>
                <p>Add your first bookmark using the button above!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FullPageBookmarks;