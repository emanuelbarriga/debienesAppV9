import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageNumbers: number[];
  onPageChange: (page: number) => void;
  onFirstPage: () => void;
  onLastPage: () => void;
  onNextPage: () => void;
  onPreviousPage: () => void;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  itemsPerPage: number;
  onItemsPerPageChange: (items: number) => void;
  totalItems: number;
}

const itemsPerPageOptions = [10, 25, 50, 100];

export function Pagination({
  currentPage,
  totalPages,
  pageNumbers,
  onPageChange,
  onFirstPage,
  onLastPage,
  onNextPage,
  onPreviousPage,
  hasNextPage,
  hasPreviousPage,
  itemsPerPage,
  onItemsPerPageChange,
  totalItems
}: PaginationProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-4 py-3 bg-white border-t border-gray-200">
      {/* Items per page selector */}
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <span>Mostrar</span>
        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          className="border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
        >
          {itemsPerPageOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span>por página</span>
      </div>

      {/* Page information */}
      <div className="text-sm text-gray-700">
        <span>
          Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} a{' '}
          {Math.min(currentPage * itemsPerPage, totalItems)} de {totalItems} resultados
        </span>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={onFirstPage}
          disabled={!hasPreviousPage}
          className={`p-2 rounded-md ${
            hasPreviousPage
              ? 'text-gray-700 hover:bg-gray-50'
              : 'text-gray-400 cursor-not-allowed'
          }`}
          title="Primera página"
        >
          <ChevronsLeft size={20} />
        </button>
        <button
          onClick={onPreviousPage}
          disabled={!hasPreviousPage}
          className={`p-2 rounded-md ${
            hasPreviousPage
              ? 'text-gray-700 hover:bg-gray-50'
              : 'text-gray-400 cursor-not-allowed'
          }`}
          title="Página anterior"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="flex gap-1">
          {pageNumbers.map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                currentPage === page
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {page}
            </button>
          ))}
        </div>

        <button
          onClick={onNextPage}
          disabled={!hasNextPage}
          className={`p-2 rounded-md ${
            hasNextPage
              ? 'text-gray-700 hover:bg-gray-50'
              : 'text-gray-400 cursor-not-allowed'
          }`}
          title="Página siguiente"
        >
          <ChevronRight size={20} />
        </button>
        <button
          onClick={onLastPage}
          disabled={!hasNextPage}
          className={`p-2 rounded-md ${
            hasNextPage
              ? 'text-gray-700 hover:bg-gray-50'
              : 'text-gray-400 cursor-not-allowed'
          }`}
          title="Última página"
        >
          <ChevronsRight size={20} />
        </button>
      </div>
    </div>
  );
}
