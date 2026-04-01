import { useState, useMemo } from 'react';

interface PaginationOptions {
  totalItems: number;
  itemsPerPage: number;
  currentPage: number;
  maxPages?: number;
}

interface PaginationResult<T> {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  startIndex: number;
  endIndex: number;
  pageItems: T[];
  setCurrentPage: (page: number) => void;
  setItemsPerPage: (items: number) => void;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
  pageNumbers: number[];
}

export function usePagination<T>(
  items: T[],
  options: Partial<PaginationOptions> = {}
): PaginationResult<T> {
  // Default values and state
  const [currentPage, setCurrentPage] = useState(options.currentPage || 1);
  const [itemsPerPage, setItemsPerPage] = useState(options.itemsPerPage || 10);
  const maxPages = options.maxPages || 5;

  // Calculate total pages
  const totalPages = Math.ceil(items.length / itemsPerPage);

  // Ensure current page is within bounds
  const safePage = Math.max(1, Math.min(currentPage, totalPages));
  if (safePage !== currentPage) {
    setCurrentPage(safePage);
  }

  // Calculate indices
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, items.length);

  // Get current page items
  const pageItems = useMemo(() => {
    return items.slice(startIndex, endIndex);
  }, [items, startIndex, endIndex]);

  // Calculate page numbers to display
  const pageNumbers = useMemo(() => {
    const totalPageNumbers = Math.min(maxPages, totalPages);
    const halfWay = Math.floor(totalPageNumbers / 2);
    
    let startPage = Math.max(currentPage - halfWay, 1);
    let endPage = startPage + totalPageNumbers - 1;

    if (endPage > totalPages) {
      endPage = totalPages;
      startPage = Math.max(endPage - totalPageNumbers + 1, 1);
    }

    return Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);
  }, [currentPage, totalPages, maxPages]);

  // Navigation functions
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToFirstPage = () => {
    setCurrentPage(1);
  };

  const goToLastPage = () => {
    setCurrentPage(totalPages);
  };

  return {
    currentPage,
    totalPages,
    itemsPerPage,
    startIndex,
    endIndex,
    pageItems,
    setCurrentPage,
    setItemsPerPage,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    goToLastPage,
    pageNumbers
  };
}
