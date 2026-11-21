import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

function renderInlineBold(text: string, baseStyle: any, boldStyle: any) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <Text key={idx} style={boldStyle}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return (
      <Text key={idx} style={baseStyle}>
        {part.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)').replace(/`([^`]+)`/g, '$1')}
      </Text>
    );
  });
}

export function CmsMarkdownView({
  content,
  updatedAt,
}: {
  content: string;
  updatedAt?: string;
}) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const lines = (content || '').replace(/\r\n/g, '\n').split('\n');

  return (
    <View>
      {updatedAt ? (
        <Text style={styles.lastUpdated}>
          Son Güncelleme: {new Date(updatedAt).toLocaleDateString('tr-TR')}
        </Text>
      ) : null}

      {lines.map((raw, idx) => {
        const line = raw.trim();
        if (!line) {
          return <View key={idx} style={{ height: 6 }} />;
        }
        if (line.startsWith('### ')) {
          return (
            <Text key={idx} style={styles.h3}>
              {line.slice(4).replace(/\*\*/g, '')}
            </Text>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <Text key={idx} style={styles.h2}>
              {line.slice(3).replace(/\*\*/g, '')}
            </Text>
          );
        }
        if (line.startsWith('# ')) {
          return (
            <Text key={idx} style={styles.h1}>
              {line.slice(2).replace(/\*\*/g, '')}
            </Text>
          );
        }
        if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
          const itemText = line.replace(/^[-*•]\s+/, '');
          return (
            <View key={idx} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.paragraph}>
                {renderInlineBold(itemText, styles.paragraph, styles.boldText)}
              </Text>
            </View>
          );
        }
        if (/^\d+\.\s+/.test(line)) {
          const match = line.match(/^(\d+\.)\s+(.*)$/);
          const num = match ? match[1] : '•';
          const itemText = match ? match[2] : line;
          return (
            <View key={idx} style={styles.bulletRow}>
              <Text style={styles.numberDot}>{num}</Text>
              <Text style={styles.paragraph}>
                {renderInlineBold(itemText, styles.paragraph, styles.boldText)}
              </Text>
            </View>
          );
        }
        return (
          <Text key={idx} style={styles.paragraphBlock}>
            {renderInlineBold(line, styles.paragraph, styles.boldText)}
          </Text>
        );
      })}
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    lastUpdated: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      fontStyle: 'italic',
      marginBottom: theme.spacing.md,
    },
    h1: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.colors.text,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    h2: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.colors.primary,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.xs,
    },
    h3: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.text,
      marginTop: theme.spacing.md,
      marginBottom: 4,
    },
    paragraphBlock: {
      fontSize: 14,
      lineHeight: 22,
      color: theme.colors.textSecondary,
      marginBottom: 8,
    },
    paragraph: {
      flex: 1,
      fontSize: 14,
      lineHeight: 22,
      color: theme.colors.textSecondary,
    },
    boldText: {
      fontSize: 14,
      lineHeight: 22,
      fontWeight: '700',
      color: theme.colors.text,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 6,
      paddingLeft: 4,
    },
    bulletDot: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.colors.primary,
      marginRight: 8,
      lineHeight: 22,
    },
    numberDot: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.colors.primary,
      marginRight: 8,
      lineHeight: 22,
      minWidth: 20,
    },
  });
