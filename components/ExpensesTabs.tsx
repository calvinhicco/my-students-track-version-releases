import { Expense, ExpenseCategory } from '../types/expense';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Button } from './ui/button';
import { AlertCircle } from 'lucide-react';
import { useState } from 'react';

interface ExpensesTabProps {
  expenses: Expense[];
  categories: ExpenseCategory[];
  onReversalClick: (expenseId: string) => void;
}

export function DailyExpenses({ expenses, categories, onReversalClick }: ExpensesTabProps) {
  const today = new Date();
  const todaysExpenses = expenses.filter(expense => {
    const expenseDate = new Date(expense.date);
    return expenseDate.getDate() === today.getDate() &&
           expenseDate.getMonth() === today.getMonth() &&
           expenseDate.getFullYear() === today.getFullYear();
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Purpose</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {todaysExpenses.map((expense) => (
          <TableRow key={expense.id}>
            <TableCell>{expense.purpose}</TableCell>
            <TableCell>
              {categories.find(cat => cat.id === expense.category)?.name || 'Unknown'}
            </TableCell>
            <TableCell>${expense.amount.toFixed(2)}</TableCell>
            <TableCell>{format(new Date(expense.date), 'MMM d, yyyy')}</TableCell>
            <TableCell>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReversalClick(expense.id)}
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                Reverse
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function WeeklyExpenses({ expenses, categories, onReversalClick }: ExpensesTabProps) {
  const today = new Date();
  const weekStart = today.getDate() - today.getDay();
  const weekEnd = weekStart + 6;
  const weeklyExpenses = expenses.filter(expense => {
    const expenseDate = new Date(expense.date);
    return expenseDate.getDate() >= weekStart &&
           expenseDate.getDate() <= weekEnd &&
           expenseDate.getMonth() === today.getMonth() &&
           expenseDate.getFullYear() === today.getFullYear();
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Purpose</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {weeklyExpenses.map((expense) => (
          <TableRow key={expense.id}>
            <TableCell>{expense.purpose}</TableCell>
            <TableCell>
              {categories.find(cat => cat.id === expense.category)?.name || 'Unknown'}
            </TableCell>
            <TableCell>${expense.amount.toFixed(2)}</TableCell>
            <TableCell>{format(new Date(expense.date), 'MMM d, yyyy')}</TableCell>
            <TableCell>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReversalClick(expense.id)}
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                Reverse
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function MonthlyExpenses({ expenses, categories, onReversalClick }: ExpensesTabProps) {
  const today = new Date();
  const monthlyExpenses = expenses.filter(expense => {
    const expenseDate = new Date(expense.date);
    return expenseDate.getMonth() === today.getMonth() &&
           expenseDate.getFullYear() === today.getFullYear();
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Purpose</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {monthlyExpenses.map((expense) => (
          <TableRow key={expense.id}>
            <TableCell>{expense.purpose}</TableCell>
            <TableCell>
              {categories.find(cat => cat.id === expense.category)?.name || 'Unknown'}
            </TableCell>
            <TableCell>${expense.amount.toFixed(2)}</TableCell>
            <TableCell>{format(new Date(expense.date), 'MMM d, yyyy')}</TableCell>
            <TableCell>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReversalClick(expense.id)}
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                Reverse
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function YearlyExpenses({ expenses, categories, onReversalClick }: ExpensesTabProps) {
  const today = new Date();
  const yearlyExpenses = expenses.filter(expense => {
    const expenseDate = new Date(expense.date);
    return expenseDate.getFullYear() === today.getFullYear();
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Purpose</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {yearlyExpenses.map((expense) => (
          <TableRow key={expense.id}>
            <TableCell>{expense.purpose}</TableCell>
            <TableCell>
              {categories.find(cat => cat.id === expense.category)?.name || 'Unknown'}
            </TableCell>
            <TableCell>${expense.amount.toFixed(2)}</TableCell>
            <TableCell>{format(new Date(expense.date), 'MMM d, yyyy')}</TableCell>
            <TableCell>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReversalClick(expense.id)}
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                Reverse
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
