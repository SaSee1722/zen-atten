import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { useAlert } from '@/template';
import { dataService, ClassData, Student } from '../../services/dataService';
import { colors, typography, spacing, borderRadius, shadows } from '../../constants/theme';

type AttendanceStatus = 'present' | 'absent' | 'on-duty' | 'unapproved';

export default function StaffAttendance() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [assignedClasses, setAssignedClasses] = useState<ClassData[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const subsRef = useRef<{ unsubscribe: () => void }[]>([]);

  const loadClasses = useCallback(async () => {
    try {
      const allClasses = await dataService.getClasses();
      const userClasses = allClasses.filter(
        cls => cls.advisor === user?.name
      );
      setAssignedClasses(userClasses);
    } catch (error) {
      console.error('Failed to load classes:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.name]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      loadClasses();

      subsRef.current.forEach(s => s.unsubscribe());
      subsRef.current = [
        dataService.subscribeToTable('classes', loadClasses),
      ];

      return () => {
        subsRef.current.forEach(s => s.unsubscribe());
        subsRef.current = [];
      };
    }, [user, loadClasses])
  );

  const loadStudents = async (classId: string) => {
    try {
      const studentData = await dataService.getStudentsByClass(classId);
      setStudents(studentData);
      
      // Initialize all as present (mark all present feature)
      const initialAttendance: Record<string, AttendanceStatus> = {};
      studentData.forEach(student => {
        initialAttendance[student.id] = 'present';
      });
      setAttendance(initialAttendance);
    } catch (error) {
      console.error('Failed to load students:', error);
    }
  };

  const handleClassSelect = (classId: string) => {
    setSelectedClass(classId);
    loadStudents(classId);
  };

  const handleMarkAllPresent = () => {
    const allPresent: Record<string, AttendanceStatus> = {};
    students.forEach(student => {
      allPresent[student.id] = 'present';
    });
    setAttendance(allPresent);
  };

  const toggleAttendanceStatus = (studentId: string) => {
    const currentStatus = attendance[studentId] || 'present';
    const statusCycle: AttendanceStatus[] = ['present', 'absent', 'on-duty', 'unapproved'];
    const currentIndex = statusCycle.indexOf(currentStatus);
    const nextIndex = (currentIndex + 1) % statusCycle.length;
    
    setAttendance({
      ...attendance,
      [studentId]: statusCycle[nextIndex],
    });
  };

  const handleSubmit = async () => {
    if (!selectedClass) return;

    try {
      const records = students.map(student => ({
        studentId: student.id,
        classId: selectedClass,
        date: new Date().toISOString().split('T')[0],
        status: attendance[student.id] || 'present',
        markedBy: user?.id || '',
      }));

      await dataService.markAttendance(records);
      showAlert('Success', 'Attendance marked successfully');
      setSelectedClass(null);
      setStudents([]);
      setAttendance({});
    } catch (error) {
      showAlert('Error', 'Failed to mark attendance');
    }
  };

  const getStatusConfig = (status: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return { color: colors.present, bgColor: colors.presentLight, icon: 'check-circle', label: 'Present' };
      case 'absent':
        return { color: colors.absent, bgColor: colors.absentLight, icon: 'cancel', label: 'Absent' };
      case 'on-duty':
        return { color: colors.onDuty, bgColor: colors.onDutyLight, icon: 'work', label: 'On-Duty' };
      case 'unapproved':
        return { color: colors.unapproved, bgColor: colors.unapprovedLight, icon: 'pending', label: 'Unapproved' };
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.staff} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.staff, '#D97706']}
        style={[styles.header, { paddingTop: insets.top + spacing.lg }]}
      >
        <Text style={styles.headerTitle}>Mark Attendance</Text>
        <Text style={styles.headerSubtitle}>
          {selectedClass ? 'Select student status' : 'Choose a class to begin'}
        </Text>
      </LinearGradient>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {!selectedClass ? (
          <>
            <Text style={styles.sectionTitle}>Select Class</Text>
            {assignedClasses.map((classItem) => (
              <Pressable
                key={classItem.id}
                style={({ pressed }) => [
                  styles.classCard,
                  shadows.md,
                  pressed && styles.cardPressed,
                ]}
                onPress={() => handleClassSelect(classItem.id)}
              >
                <View style={styles.classIcon}>
                  <MaterialIcons name="class" size={24} color={colors.staff} />
                </View>
                <View style={styles.classInfo}>
                  <Text style={styles.className}>{classItem.name}</Text>
                  <Text style={styles.classDetails}>
                    {classItem.studentCount} Students • {classItem.section}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={24} color={colors.textTertiary} />
              </Pressable>
            ))}
          </>
        ) : (
          <>
            <View style={styles.toolbar}>
              <Pressable
                style={({ pressed }) => [
                  styles.backButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => setSelectedClass(null)}
              >
                <MaterialIcons name="arrow-back" size={20} color={colors.staff} />
                <Text style={styles.backText}>Back</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.markAllButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={handleMarkAllPresent}
              >
                <MaterialIcons name="done-all" size={20} color={colors.success} />
                <Text style={styles.markAllText}>Mark All Present</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>
              Students ({students.length})
            </Text>

            {students.map((student) => {
              const status = attendance[student.id] || 'present';
              const config = getStatusConfig(status);

              return (
                <Pressable
                  key={student.id}
                  style={({ pressed }) => [
                    styles.studentCard,
                    shadows.sm,
                    pressed && styles.cardPressed,
                  ]}
                  onPress={() => toggleAttendanceStatus(student.id)}
                >
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{student.name}</Text>
                    <Text style={styles.studentRoll}>Roll No: {student.rollNo}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: config.bgColor }]}>
                    <MaterialIcons name={config.icon as any} size={18} color={config.color} />
                    <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
                  </View>
                </Pressable>
              );
            })}

            <Pressable
              style={({ pressed }) => [
                styles.submitButton,
                shadows.lg,
                pressed && styles.buttonPressed,
              ]}
              onPress={handleSubmit}
            >
              <LinearGradient
                colors={[colors.staff, '#D97706']}
                style={styles.submitGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <MaterialIcons name="check" size={24} color="#FFFFFF" />
                <Text style={styles.submitText}>Submit Attendance</Text>
              </LinearGradient>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  header: {
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  headerTitle: {
    ...typography.h1,
    fontSize: 24,
    color: '#FFFFFF',
  },
  headerSubtitle: {
    ...typography.caption,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: spacing.xs,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  classCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  classIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.staffLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  classInfo: {
    flex: 1,
  },
  className: {
    ...typography.h3,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  classDetails: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  backText: {
    ...typography.bodyMedium,
    color: colors.staff,
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  markAllText: {
    ...typography.bodyMedium,
    color: colors.success,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  studentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  studentRoll: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  statusText: {
    ...typography.label,
    fontSize: 12,
  },
  submitButton: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginTop: spacing.lg,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  submitText: {
    ...typography.bodyMedium,
    fontSize: 18,
    color: '#FFFFFF',
  },
});
